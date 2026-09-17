/**
 * Native PAM Module Harness for macOS
 * Tests the compiled pam_openfaceid_mac.so shared library directly using
 * Apple PAM subsystem (pam_start/pam_end) against the running Unix domain socket server.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>
#include <security/pam_appl.h>
#include <security/pam_modules.h>

static int dummy_conv(int num_msg, const struct pam_message **msg,
                      struct pam_response **resp, void *appdata_ptr) {
    (void)num_msg;
    (void)msg;
    (void)resp;
    (void)appdata_ptr;
    return PAM_SUCCESS;
}

typedef int (*pam_func_t)(pam_handle_t *, int, int, const char **);

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <path_to_pam_so> [username]\n", argv[0]);
        return 1;
    }

    const char *so_path = argv[1];
    const char *username = argc >= 3 ? argv[2] : "test_user";

    struct pam_conv conv = { dummy_conv, NULL };
    pam_handle_t *pamh = NULL;
    int start_rc = pam_start("check_user", username, &conv, &pamh);
    if (start_rc != PAM_SUCCESS) {
        fprintf(stderr, "pam_start failed: %d\n", start_rc);
        return 2;
    }

    void *handle = dlopen(so_path, RTLD_NOW | RTLD_GLOBAL);
    if (!handle) {
        fprintf(stderr, "dlopen failed: %s\n", dlerror());
        pam_end(pamh, start_rc);
        return 3;
    }

    pam_func_t authenticate = (pam_func_t)dlsym(handle, "pam_sm_authenticate");
    if (!authenticate) {
        fprintf(stderr, "dlsym failed: %s\n", dlerror());
        dlclose(handle);
        pam_end(pamh, start_rc);
        return 4;
    }

    int rc = authenticate(pamh, 0, 0, NULL);
    printf("PAM_RESULT=%d\n", rc);

    dlclose(handle);
    pam_end(pamh, rc);
    return 0;
}
