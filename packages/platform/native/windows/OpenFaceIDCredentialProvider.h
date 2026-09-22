/*
 * OpenFaceID Native Windows Credential Provider Header
 *
 * Copyright (c) 2026 Jayant Olhyan <https://github.com/JayantOlhyan>
 * Licensed under the Apache License, Version 2.0.
 *
 * Implements the Windows ICredentialProvider and ICredentialProviderCredential2
 * COM interfaces for Windows 10/11 LogonUI lock screen integration.
 */

#pragma once

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <credentialprovider.h>
#include <ntsecapi.h>
#include <string>

// CLSID for OpenFaceID Credential Provider: {7B8F9A12-3D4E-4A5F-8C9B-0E1F2A3B4C5D}
static const CLSID CLSID_OpenFaceIDCredentialProvider = 
    { 0x7b8f9a12, 0x3d4e, 0x4a5f, { 0x8c, 0x9b, 0x0e, 0x1f, 0x2a, 0x3b, 0x4c, 0x5d } };

class COpenFaceIDCredentialProvider : public ICredentialProvider {
public:
    // IUnknown
    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv);
    IFACEMETHODIMP_(ULONG) AddRef();
    IFACEMETHODIMP_(ULONG) Release();

    // ICredentialProvider
    IFACEMETHODIMP SetUsageScenario(CREDENTIAL_PROVIDER_USAGE_SCENARIO cpus, DWORD dwFlags);
    IFACEMETHODIMP SetSerialization(const CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION* pcpcs);
    IFACEMETHODIMP Advise(ICredentialProviderEvents* pcpe, UINT_PTR upAdviseContext);
    IFACEMETHODIMP UnAdvise();
    IFACEMETHODIMP GetFieldDescriptorCount(DWORD* pdwCount);
    IFACEMETHODIMP GetFieldDescriptorAt(DWORD dwIndex, CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR** ppcpfd);
    IFACEMETHODIMP GetCredentialCount(DWORD* pdwCount, DWORD* pdwDefault, BOOL* pbAutoLogonWithDefault);
    IFACEMETHODIMP GetCredentialAt(DWORD dwIndex, ICredentialProviderCredential** ppcpc);

    COpenFaceIDCredentialProvider();
    virtual ~COpenFaceIDCredentialProvider();

private:
    long _cRef;
    CREDENTIAL_PROVIDER_USAGE_SCENARIO _cpus;
    class COpenFaceIDCredential* _pCredential;
};
