FROM --platform=linux/amd64 ubuntu:22.04

RUN apt-get update && apt-get install -y \
    gcc \
    make \
    && rm -rf /var/lib/apt/lists/*

ENV TARGETARCH=amd64

WORKDIR /app
COPY . .

RUN make clean && make

CMD ["./x86_sample"]
