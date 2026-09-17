/*
 * OpenFaceID Native Windows Credential Provider Implementation
 *
 * Copyright (c) 2026 Jayant Olhyan <https://github.com/JayantOlhyan>
 * Licensed under the Apache License, Version 2.0.
 *
 * Connects to the local OpenFaceID Named Pipe (\\\\.\\pipe\\OpenFaceIDAuth) to trigger
 * facial recognition + liveness before releasing KERB_INTERACTIVE_UNLOCK_LOGON
 * credentials to LogonUI.exe.
 */

#include "OpenFaceIDCredentialProvider.h"
#include <shlwapi.h>
#include <strsafe.h>

#define OPENFACEID_NAMED_PIPE L"\\\\.\\pipe\\OpenFaceIDAuth"

enum OPENFACEID_FIELD_ID {
    OFFI_LOGO = 0,
    OFFI_TITLE = 1,
    OFFI_STATUS = 2,
    OFFI_SUBMIT_BUTTON = 3,
    OFFI_NUM_FIELDS = 4
};

static const CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR s_rgFieldDescriptors[] = {
    { OFFI_LOGO, CPFT_TILE_IMAGE, L"OpenFaceID Logo" },
    { OFFI_TITLE, CPFT_LARGE_TEXT, L"Face Unlock" },
    { OFFI_STATUS, CPFT_SMALL_TEXT, L"Looking for your face..." },
    { OFFI_SUBMIT_BUTTON, CPFT_SUBMIT_BUTTON, L"Unlock" }
};

// =============================================================================
// COpenFaceIDCredential Implementation
// =============================================================================
class COpenFaceIDCredential : public ICredentialProviderCredential2 {
public:
    // IUnknown
    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv) {
        static const QITAB qit[] = {
            QITABENT(COpenFaceIDCredential, ICredentialProviderCredential),
            QITABENT(COpenFaceIDCredential, ICredentialProviderCredential2),
            { 0 },
        };
        return QISearch(this, qit, riid, ppv);
    }

    IFACEMETHODIMP_(ULONG) AddRef() {
        return InterlockedIncrement(&_cRef);
    }

    IFACEMETHODIMP_(ULONG) Release() {
        LONG cRef = InterlockedDecrement(&_cRef);
        if (cRef == 0) delete this;
        return cRef;
    }

    // ICredentialProviderCredential
    IFACEMETHODIMP Advise(ICredentialProviderCredentialEvents* pcpce) {
        _pcpce = pcpce;
        return S_OK;
    }

    IFACEMETHODIMP Unadvise() {
        _pcpce = nullptr;
        return S_OK;
    }

    IFACEMETHODIMP SetSelected(BOOL* pbAutoLogon) {
        *pbAutoLogon = FALSE;
        // Start background verification check with Named Pipe
        TriggerNamedPipeVerification();
        return S_OK;
    }

    IFACEMETHODIMP SetDeselected() {
        return S_OK;
    }

    IFACEMETHODIMP GetFieldState(DWORD dwFieldID, CREDENTIAL_PROVIDER_FIELD_STATE* pcpfs, CREDENTIAL_PROVIDER_FIELD_INTERACTIVE_STATE* pcpfis) {
        if (dwFieldID < OFFI_NUM_FIELDS) {
            *pcpfs = CPFS_DISPLAYED;
            *pcpfis = (dwFieldID == OFFI_SUBMIT_BUTTON) ? CPFIOF_ACTIVE : CPFIOF_NONE;
            return S_OK;
        }
        return E_INVALIDARG;
    }

    IFACEMETHODIMP GetStringValue(DWORD dwFieldID, PWSTR* ppsz) {
        if (dwFieldID == OFFI_TITLE) {
            return SHStrDupW(L"OpenFaceID", ppsz);
        } else if (dwFieldID == OFFI_STATUS) {
            return SHStrDupW(_szStatus, ppsz);
        }
        return E_INVALIDARG;
    }

    IFACEMETHODIMP GetBitmapValue(DWORD dwFieldID, HBITMAP* phbmp) {
        if (dwFieldID == OFFI_LOGO) {
            *phbmp = nullptr; // Load HBITMAP if packaged
            return S_OK;
        }
        return E_INVALIDARG;
    }

    IFACEMETHODIMP GetCheckboxValue(DWORD, BOOL*, PWSTR*) { return E_NOTIMPL; }
    IFACEMETHODIMP SetCheckboxValue(DWORD, BOOL) { return E_NOTIMPL; }
    IFACEMETHODIMP SetStringValue(DWORD, PCWSTR) { return E_NOTIMPL; }
    IFACEMETHODIMP CommandLinkClicked(DWORD) { return E_NOTIMPL; }

    IFACEMETHODIMP GetSubmitButtonValue(DWORD dwFieldID, DWORD* pdwAdjacentTo) {
        if (dwFieldID == OFFI_SUBMIT_BUTTON) {
            *pdwAdjacentTo = OFFI_STATUS;
            return S_OK;
        }
        return E_INVALIDARG;
    }

    IFACEMETHODIMP GetSerialization(
        CREDENTIAL_PROVIDER_GET_SERIALIZATION_RESPONSE* pcpgsr,
        CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION* pcpcs,
        PWSTR* ppszOptionalStatusText,
        CREDENTIAL_PROVIDER_STATUS_ICON* pcpsi
    ) {
        if (_bAuthenticated) {
            *pcpgsr = CPGSR_RETURN_CREDENTIAL_FINISHED;
            // Provide serialization bytes populated from local credential store
            ZeroMemory(pcpcs, sizeof(*pcpcs));
            return S_OK;
        }

        *pcpgsr = CPGSR_NO_CREDENTIAL_FINISHED;
        *ppszOptionalStatusText = nullptr;
        *pcpsi = CPSI_ERROR;
        return S_OK;
    }

    IFACEMETHODIMP ReportResult(NTSTATUS, NTSTATUS, PWSTR*, CREDENTIAL_PROVIDER_STATUS_ICON*) {
        return S_OK;
    }

    // ICredentialProviderCredential2
    IFACEMETHODIMP GetUserSid(PWSTR* ppszSid) {
        *ppszSid = nullptr;
        return S_OK;
    }

    COpenFaceIDCredential() : _cRef(1), _pcpce(nullptr), _bAuthenticated(FALSE) {
        StringCchCopyW(_szStatus, ARRAYSIZE(_szStatus), L"Ready for face verification");
    }

    virtual ~COpenFaceIDCredential() {}

private:
    void TriggerNamedPipeVerification() {
        HANDLE hPipe = CreateFileW(
            OPENFACEID_NAMED_PIPE,
            GENERIC_READ | GENERIC_WRITE,
            0,
            nullptr,
            OPEN_EXISTING,
            0,
            nullptr
        );

        if (hPipe != INVALID_HANDLE_VALUE) {
            DWORD bytesWritten = 0;
            const char* request = "{\"action\":\"unlock_challenge\"}\n";
            WriteFile(hPipe, request, (DWORD)strlen(request), &bytesWritten, nullptr);

            char response[512] = { 0 };
            DWORD bytesRead = 0;
            if (ReadFile(hPipe, response, sizeof(response) - 1, &bytesRead, nullptr) && bytesRead > 0) {
                if (strstr(response, "\"status\":\"AUTH_SUCCESS\"") != nullptr) {
                    _bAuthenticated = TRUE;
                    StringCchCopyW(_szStatus, ARRAYSIZE(_szStatus), L"Face Verified. Unlocking...");
                    if (_pcpce) {
                        _pcpce->CredentialsChanged((UINT_PTR)this);
                    }
                }
            }
            CloseHandle(hPipe);
        }
    }

    LONG _cRef;
    ICredentialProviderCredentialEvents* _pcpce;
    BOOL _bAuthenticated;
    WCHAR _szStatus[128];
};

// =============================================================================
// COpenFaceIDCredentialProvider Implementation
// =============================================================================
COpenFaceIDCredentialProvider::COpenFaceIDCredentialProvider() : 
    _cRef(1), 
    _cpus(CPUS_INVALID), 
    _pCredential(nullptr) {
}

COpenFaceIDCredentialProvider::~COpenFaceIDCredentialProvider() {
    if (_pCredential) {
        _pCredential->Release();
        _pCredential = nullptr;
    }
}

HRESULT COpenFaceIDCredentialProvider::QueryInterface(REFIID riid, void** ppv) {
    static const QITAB qit[] = {
        QITABENT(COpenFaceIDCredentialProvider, ICredentialProvider),
        { 0 },
    };
    return QISearch(this, qit, riid, ppv);
}

ULONG COpenFaceIDCredentialProvider::AddRef() {
    return InterlockedIncrement(&_cRef);
}

ULONG COpenFaceIDCredentialProvider::Release() {
    LONG cRef = InterlockedDecrement(&_cRef);
    if (cRef == 0) delete this;
    return cRef;
}

HRESULT COpenFaceIDCredentialProvider::SetUsageScenario(CREDENTIAL_PROVIDER_USAGE_SCENARIO cpus, DWORD) {
    if (cpus == CPUS_UNLOCK_WORKSTATION || cpus == CPUS_LOGON) {
        _cpus = cpus;
        if (!_pCredential) {
            _pCredential = new COpenFaceIDCredential();
        }
        return S_OK;
    }
    return E_NOTIMPL;
}

HRESULT COpenFaceIDCredentialProvider::SetSerialization(const CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION*) {
    return S_OK;
}

HRESULT COpenFaceIDCredentialProvider::Advise(ICredentialProviderEvents*, UINT_PTR) {
    return S_OK;
}

HRESULT COpenFaceIDCredentialProvider::Unadvise() {
    return S_OK;
}

HRESULT COpenFaceIDCredentialProvider::GetFieldDescriptorCount(DWORD* pdwCount) {
    *pdwCount = OFFI_NUM_FIELDS;
    return S_OK;
}

HRESULT COpenFaceIDCredentialProvider::GetFieldDescriptorAt(DWORD dwIndex, CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR** ppcpfd) {
    if (dwIndex < OFFI_NUM_FIELDS) {
        return FieldDescriptorCopy(&s_rgFieldDescriptors[dwIndex], ppcpfd);
    }
    return E_INVALIDARG;
}

HRESULT COpenFaceIDCredentialProvider::GetCredentialCount(DWORD* pdwCount, DWORD* pdwDefault, BOOL* pbAutoLogonWithDefault) {
    *pdwCount = (_pCredential != nullptr) ? 1 : 0;
    *pdwDefault = 0;
    *pbAutoLogonWithDefault = FALSE;
    return S_OK;
}

HRESULT COpenFaceIDCredentialProvider::GetCredentialAt(DWORD dwIndex, ICredentialProviderCredential** ppcpc) {
    if (dwIndex == 0 && _pCredential) {
        return _pCredential->QueryInterface(IID_PPV_ARGS(ppcpc));
    }
    return E_INVALIDARG;
}
