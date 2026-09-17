# Makefile for pam_openfaceid Linux PAM Module
#
# Requirements: gcc, libpam0g-dev (Debian/Ubuntu) or pam-devel (Fedora/RHEL/Arch)

CC ?= gcc
CFLAGS ?= -fPIC -fno-stack-protector -Wall -Wextra -O2
LDFLAGS ?= -shared -lpam

TARGET = pam_openfaceid.so
SRC = pam_openfaceid.c
OBJ = pam_openfaceid.o

all: $(TARGET)

$(OBJ): $(SRC)
	$(CC) $(CFLAGS) -c $(SRC) -o $(OBJ)

$(TARGET): $(OBJ)
	$(CC) $(LDFLAGS) -o $(TARGET) $(OBJ)

clean:
	rm -f $(OBJ) $(TARGET)

install: $(TARGET)
	@echo "Installing $(TARGET) to system PAM directory..."
	@if [ -d /lib/x86_64-linux-gnu/security ]; then \
		install -m 0644 $(TARGET) /lib/x86_64-linux-gnu/security/; \
	elif [ -d /lib/aarch64-linux-gnu/security ]; then \
		install -m 0644 $(TARGET) /lib/aarch64-linux-gnu/security/; \
	elif [ -d /lib64/security ]; then \
		install -m 0644 $(TARGET) /lib64/security/; \
	else \
		install -m 0644 $(TARGET) /lib/security/; \
	fi
	@echo "✓ pam_openfaceid.so installed successfully."

.PHONY: all clean install
