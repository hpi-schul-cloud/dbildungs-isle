# Use the LinuxServer Firefox image as the base
FROM lscr.io/linuxserver/firefox:latest

# Update package list and install Kerberos client
RUN apt-get update && \
    apt-get install -y --no-install-recommends krb5-user && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Expose ports (optional, based on your use case)
EXPOSE 3000 3001
