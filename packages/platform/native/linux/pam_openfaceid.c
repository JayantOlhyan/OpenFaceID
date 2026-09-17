/*
 * OpenFaceID Native Linux PAM Authentication Module (pam_openfaceid)
 *
 * Copyright (c) 2026 Jayant Olhyan <https://github.com/JayantOlhyan>
 * Licensed under the Apache License, Version 2.0.
 *
 * This module connects to the local OpenFaceID daemon over a Unix Domain
 * Socket (/run/openfaceid/auth.sock) to perform biometric facial authentication
 * and liveness verification before granting PAM authorization.
 */

#define PAM_SM_AUTH
#include <security/pam_modules.h>
#include <security/pam_appl.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <syslog.h>
#include <errno.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/time.h>

#define PRIMARY_SOCKET_PATH   "/run/openfaceid/auth.sock"
#define FALLBACK_SOCKET_PATH  "/var/run/openfaceid.sock"
#define TMP_SOCKET_PATH       "/tmp/openfaceid-auth.sock"
#define BUFFER_SIZE           1024
#define DEFAULT_TIMEOUT_SEC   5

static int connect_to_daemon(void) {
    int sock = socket(AF_UNIX, SOCK_STREAM, 0);
    if (sock < 0) {
        return -1;
    }

    struct timeval tv;
    tv.tv_sec = DEFAULT_TIMEOUT_SEC;
    tv.tv_usec = 0;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char *)&tv, sizeof(tv));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, (const char *)&tv, sizeof(tv));

    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;

    // Try primary path (/run/openfaceid/auth.sock)
    strncpy(addr.sun_path, PRIMARY_SOCKET_PATH, sizeof(addr.sun_path) - 1);
    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) == 0) {
        return sock;
    }

    // Try fallback path (/var/run/openfaceid.sock)
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, FALLBACK_SOCKET_PATH, sizeof(addr.sun_path) - 1);
    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) == 0) {
        return sock;
    }

    // Try user/dev path (/tmp/openfaceid-auth.sock)
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, TMP_SOCKET_PATH, sizeof(addr.sun_path) - 1);
    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) == 0) {
        return sock;
    }

    close(sock);
    return -1;
}

PAM_EXTERN int pam_sm_authenticate(pam_handle_t *pamh, int flags, int argc, const char **argv) {
    const char *username = NULL;
    int retval;

    openlog("pam_openfaceid", LOG_PID | LOG_CONS, LOG_AUTH);

    // Retrieve username from PAM
    retval = pam_get_user(pamh, &username, NULL);
    if (retval != PAM_SUCCESS || username == NULL || strlen(username) == 0) {
        syslog(LOG_WARNING, "Failed to determine username from PAM");
        closelog();
        return PAM_USER_UNKNOWN;
    }

    syslog(LOG_INFO, "Initiating facial authentication challenge for user: %s", username);

    // Connect to OpenFaceID local Unix socket
    int sock = connect_to_daemon();
    if (sock < 0) {
        syslog(LOG_NOTICE, "OpenFaceID daemon socket unavailable. Falling through to standard authentication.");
        closelog();
        // Return PAM_IGNORE or PAM_AUTHINFO_UNAVAIL so standard password entry succeeds
        return PAM_AUTHINFO_UNAVAIL;
    }

    // Send authentication request formatted as JSON: {"action":"authenticate","user":"..."}\n
    char request[BUFFER_SIZE];
    snprintf(request, sizeof(request), "{\"action\":\"authenticate\",\"user\":\"%s\"}\n", username);

    ssize_t sent = write(sock, request, strlen(request));
    if (sent < 0) {
        syslog(LOG_ERR, "Failed to write authentication request to daemon: %s", strerror(errno));
        close(sock);
        closelog();
        return PAM_AUTHINFO_UNAVAIL;
    }

    // Read response from OpenFaceID daemon
    char response[BUFFER_SIZE];
    memset(response, 0, sizeof(response));
    ssize_t bytes_read = read(sock, response, sizeof(response) - 1);
    close(sock);

    if (bytes_read <= 0) {
        syslog(LOG_WARNING, "No response or timeout from OpenFaceID daemon");
        closelog();
        return PAM_AUTHINFO_UNAVAIL;
    }

    // Inspect authorization response
    if (strstr(response, "\"status\":\"AUTH_SUCCESS\"") != NULL ||
        strstr(response, "AUTH_SUCCESS") != NULL) {
        syslog(LOG_INFO, "Facial presence verification PASSED for user: %s", username);
        closelog();
        return PAM_SUCCESS;
    }

    if (strstr(response, "\"status\":\"AUTH_LIVENESS_FAILED\"") != NULL) {
        syslog(LOG_WARNING, "Facial presence REJECTED (liveness check failed) for user: %s", username);
    } else if (strstr(response, "\"status\":\"AUTH_AMBIGUOUS\"") != NULL) {
        syslog(LOG_WARNING, "Facial presence REJECTED (multiple faces detected) for user: %s", username);
    } else {
        syslog(LOG_NOTICE, "Facial recognition match negative or timeout for user: %s", username);
    }

    closelog();
    return PAM_AUTH_ERR;
}

PAM_EXTERN int pam_sm_setcred(pam_handle_t *pamh, int flags, int argc, const char **argv) {
    return PAM_SUCCESS;
}
