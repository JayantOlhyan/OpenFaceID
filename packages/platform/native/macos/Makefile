CC ?= clang
CFLAGS ?= -O3 -fPIC -Wall -Wextra
LDFLAGS ?= -dynamiclib -lpam

TARGET = pam_openfaceid_mac.so
SRC = pam_openfaceid_mac.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $<

clean:
	rm -f $(TARGET)

.PHONY: all clean
