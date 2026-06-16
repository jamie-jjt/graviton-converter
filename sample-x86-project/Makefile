# Makefile for x86 sample project
CC = gcc
CFLAGS = -O2 -march=haswell -msse4.2 -mavx2 -Wall
LDFLAGS = -lm

SRCDIR = src
SOURCES = $(SRCDIR)/main.c $(SRCDIR)/vector_math.c $(SRCDIR)/cpu_detect.c \
          $(SRCDIR)/timing.c $(SRCDIR)/bitops.c
OBJECTS = $(SOURCES:.c=.o)
TARGET = x86_sample

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CC) $(CFLAGS) $(OBJECTS) -o $(TARGET) $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJECTS) $(TARGET)
