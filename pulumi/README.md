# Pulumi IaC & Pulumi ESC

## Installation

```bash
curl -fsSL https://get.pulumi.com | sh
curl -fsSL https://get.pulumi.com/esc/install.sh | sh
export AWS_PROFILE=davecranwell-dev
```

### Setup EC2 keypair

```bash
ssh-keygen -t rsa -b 4096 -C "dave@davecranwell.com" -f ~/.ssh/id_rsa -N ""
```

### Create envs

Wherever `modeller/dev` exists, this refers to Pulumi ESC's syntax of `<project-name>/<environment-name>`

```bash
esc login
esc env init modeller/dev
esc env init modeller/prod
```

It seems that whenever you create a new environment, you have to manually move it to the `modeller` project by using `esc env edit modeller/dev`

### List envs:

```bash
esc env list
```

### Store env values:

The `pulumiConfig` prefix is required by Pulumi to put it into the section accessible by `pulumi config get`.

```bash
esc env set modeller/dev pulumiConfig.myNonSecretValue foo
esc env set modeller/dev pulumiConfig.mySecretValue demo-password-123 --secret
```

### Necessary pulumi config

```bash
pulumi config set appName=<app-name>
pulumi config set containerPort=<port>
```

### Read env values unencrypted:

```bash
esc env open modeller/dev
```

or

```bash
pulumi config get mySecretName
```

## AWS Configuration

```bash
export AWS_PROFILE='name-of-accountrole-id' # e.g AdministratorAccess-1234567890
```

`aws configure list` should return the profile name you just set with key and secret. If it doesn't log in and try again.

SSO session name: davecranwell
CLI default client region: us-east-1

```bash
#aws sso login --sso-session=davecranwell # This only works with "aws:profile: davecranwell-dev" in the Pulumi.dev.yaml file, which we can't commit because it breaks Github actions
aws configure  # this works better but you'll need to refer to your actual aws key/secret
aws sso login --profile davecranwell-dev
pulumi up
```

## Information about the stack and outputs

```bash
pulumi stack ls
pulumi stack output
```

## Destroying

```bash
pulumi destroy
```

## Secrets

```bash
pulumi config set --secretdbPassword=<password>
```

## Debuging

Remember that lambda@edge functions create logs in the closest region to you.
