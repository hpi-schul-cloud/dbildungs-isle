#!/bin/bash

# Generate some test certificates which are used by the regression test suite:
#
#   tls/ca.{crt,key}          Self signed CA certificate.
#   tls/redis.{crt,key}       A certificate with no key usage/policy restrictions.
#   tls/client.{crt,key}      A certificate restricted for SSL client usage.
#   tls/server.{crt,key}      A certificate restricted for SSL server usage.
#   tls/redis.dh              DH Params file.

CERT_DIR="/tmp/tls"

generate_cert() {
    local name=$1
    local cn="$2"
    local opts="$3"

    local keyfile=$CERT_DIR/${name}.key
    local certfile=$CERT_DIR/${name}.crt

    [ -f $keyfile ] || openssl genrsa -out $keyfile 2048
    openssl req \
        -new -sha256 \
        -subj "/O=Redis Test/CN=$cn" \
        -key $keyfile | \
        openssl x509 \
            -req -sha256 \
            -CA $CERT_DIR/ca.crt \
            -CAkey $CERT_DIR/ca.key \
            -CAserial $CERT_DIR/ca.txt \
            -CAcreateserial \
            -days 365 \
            $opts \
            -out $certfile
}

mkdir -p $CERT_DIR
[ -f $CERT_DIR/ca.key ] || openssl genrsa -out $CERT_DIR/ca.key 4096
openssl req \
    -x509 -new -nodes -sha256 \
    -key $CERT_DIR/ca.key \
    -days 3650 \
    -subj '/O=Redis Test/CN=Certificate Authority' \
    -out $CERT_DIR/ca.crt

cat > $CERT_DIR/openssl.cnf <<_END_
[ server_cert ]
keyUsage = digitalSignature, keyEncipherment
nsCertType = server

[ client_cert ]
keyUsage = digitalSignature, keyEncipherment
nsCertType = client
_END_

generate_cert server "Server-only" "-extfile $CERT_DIR/openssl.cnf -extensions server_cert"
generate_cert client "Client-only" "-extfile $CERT_DIR/openssl.cnf -extensions client_cert"
generate_cert redis "Generic-cert"

[ -f $CERT_DIR/redis.dh ] || openssl dhparam -out $CERT_DIR/redis.dh 2048