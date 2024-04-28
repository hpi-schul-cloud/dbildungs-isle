#!/bin/bash
STAGING_DIR="/staging"
MOUNTED_FILES_DIR="/tls"
CONFIG_DIR=/data/tls

# Setup working environment

mkdir -p $STAGING_DIR
mkdir -p $CONFIG_DIR
# Copy generator script
cp -v $MOUNTED_FILES_DIR/gencert.sh /staging

# Begin Bracket
pushd $STAGING_DIR || exit 1

chmod ugo+x gencert.sh
./gencert.sh
# We have generated our certificates, now we put them in their right place
cp -v tls/redis.crt tls/redis.key tls/ca.crt $CONFIG_DIR
# Pre-Made config, correct certs and disabling of non-tls included
cp -v $MOUNTED_FILES_DIR/redis.conf $CONFIG_DIR

# Copy certificates for Redis cluster nodes
NUM_NODES=6 
for ((i=0; i<$NUM_NODES; i++)); do
    cp -v tls/redis-$i.crt tls_cluster/redis-$i.key $CONFIG_DIR
done
# End Bracket
popd || exit 1

# $CONFIG_DIR remains behind, that is the point of this script, Staging is cleaned away
rm -rf $STAGING_DIR