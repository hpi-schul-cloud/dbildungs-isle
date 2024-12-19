docker run -d \
--name=firefox \
--security-opt seccomp=unconfined `#optional` \
-e PUID=1000 \
-e PGID=1000 \
-e TZ=Etc/UTC \
-e FIREFOX_CLI=https://host.docker.internal:8099 `#optional` \
-p 3000:3000 \
-p 3001:3001 \
--shm-size="1gb" \
--restart unless-stopped \
lscr.io/linuxserver/firefox:latest
