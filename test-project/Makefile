CC = gcc
CFLAGS = -O2 -march=haswell -mtune=intel -msse4.2 -mavx2 -mfma
LDFLAGS = -lpthread -lm

TARGET = myapp
SRCS = main.c crypto.c simd_ops.c
OBJS = $(SRCS:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: all clean
