# Installing

Had some issues with SST tunnel installation which required me to symlink the current node version to /usr/local/bin/node

```
sudo ln -s $(which node) /usr/local/bin/node
```

Then from the root directory:

```
sudo $(which npx) sst tunnel install
```

## Install DB schema

```
npx sst shell --target Prisma -- npx prisma migrate dev
npx sst shell --target Prisma -- npx prisma db seed
```

# Running

In one terminal

```
docker compose up
```

In another terminal

```
ip tuntap del sst mode tun && npx sst dev
```

(the first part seems a bug in sst tunnel, which doesn't close properly on exit)
