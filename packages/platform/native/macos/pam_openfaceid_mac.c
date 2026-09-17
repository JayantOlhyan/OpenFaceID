/**
 * OpenFaceID Native macOS PAM Module
 *
 * Implements legitimate macOS authentication via PAM stack (/etc/pam.d/screensaver, /etc/pam.d/sudo).
 * Interacts with OpenFaceID engine over local Unix Domain Socket (/var/run/openfaceid/auth.sock).
 *
 * Returns PAM_SUCCESS if face liveness + recognition succeeds.
 * Returns PAM_IGNORE if daemon is inactive, gracefully falling back to password/Touch ID.
 * Returns PAM_AUTH_ERR if face verification explicitly fails or times out.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/time.h>
#include <errno.h>

#define PAM_SM_AUTH
#include <security/pam_appl.h>
#include <security/pam_modules.h>

#define PRIMARY_SOCKET_PATH "/var/run/openfaceid/auth.sock"
#define FALLBACK_SOCKET_PATH "/tmp/openfaceid_auth.sock"
#define TIMEOUT_SECONDS 3

static int connect_openfaceid_socket(void) {
    int sock = socket(AF_UNIX, SOCK_STREAM, 0);
    if (sock < 0) return -1;

    struct timeval tv;
    tv.tv_sec = TIMEOUT_SECONDS;
    tv.tv_usec = 0;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, (const char*)&tv, sizeof(tv));

    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;

    // Try primary system socket path
    strncpy(addr.sun_path, PRIMARY_SOCKET_PATH, sizeof(addr.sun_path) - 1);
    if (connect(sock, (struct sockaddr*)&addr, sizeof(addr)) == 0) {
        return sock;
    }

    // Try fallback user socket path
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, FALLBACK_SOCKET_PATH, sizeof(addr.sun_path) - 1);
    if (connect(sock, (struct sockaddr*)&addr, sizeof(addr)) == 0) {
        return sock;
    }

    close(sock);
    return -1;
}

PAM_EXTERN int pam_sm_authenticate(pam_handle_t *pamh, int flags, int argc, const char **argv) {
    (void)flags;
    (void)argc;
    (void)argv;

    if (!pamh) {
        return PAM_SYSTEM_ERR;
    }

    const char *user = NULL;
    int retval = pam_get_user(pamh, &user, NULL);
    if (retval != PAM_SUCCESS || !user || strlen(user) == 0) {
        return PAM_USER_UNKNOWN;
    }

    int sock = connect_openfaceid_socket();
    if (sock < 0) {
        // Daemon not running; gracefully ignore so password prompt takes over immediately
        return PAM_IGNORE;
    }

    char request_buf[512];
    int req_len = snprintf(request_buf, sizeof(request_buf),
        "{\"action\":\"authenticate\",\"user\":\"%s\",\"source\":\"macos_pam\"}\n", user);

    if (write(sock, request_buf, req_len) <= 0) {
        close(sock);
        return PAM_IGNORE;
    }

    char response_buf[1024];
    memset(response_buf, 0, sizeof(response_buf));
    ssize_t bytes_read = read(sock, response_buf, sizeof(response_buf) - 1);
    close(sock);

    if (bytes_read <= 0) {
        return PAM_AUTH_ERR;
    }

    response_buf[bytes_read] = '\0';

    if (strstr(response_buf, "\"status\":\"AUTHORIZED\"") != NULL) {
        return PAM_SUCCESS;
    }

    if (strstr(response_buf, "\"status\":\"DENIED\"") != NULL) {
        return PAM_AUTH_ERR;
    }

    return PAM_AUTH_ERR;
}

PAM_EXTERN int pam_sm_setcred(pam_handle_t *pamh, int flags, int argc, const char **argv) {
    (void)pamh;
    (void)flags;
    (void)argc;
    (void)argv;
    return PAM_SUCCESS;
}
