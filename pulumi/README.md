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
esc env ls
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
aws configure sso

SSO session name (Recommended): davecranwell
SSO start URL [None]: https://davecranwellaws.awsapps.com/start/
SSO region [None]: us-east-1
```

```bash
export AWS_PROFILE='name-of-accountrole-id' # e.g AdministratorAccess-1234567890
```

`aws configure list` should return the profile name you just set with key and secret. If it doesn't log in and try again. `aws configure  list --profile AdministratorAccess-1234567890` will show it unless you set it as default using `export AWS_PROFILE=AdministratorAccess-1234567890`

SSO session name: davecranwell
CLI default client region: us-east-1

```bash
#aws sso login --sso-session=davecranwell # This only works with "aws:profile: davecranwell-dev" in the Pulumi.dev.yaml file, which we can't commit because it breaks Github actions
aws configure  # this works better but you'll need to refer to your actual aws key/secret
aws sso login --profile AdministratorAccess-1234567890
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

## Pushing container updates

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 156041424020.dkr.ecr.us-east-1.amazonaws.com

# 2. Build the image

docker build -t webapp ./webapp

# 3. Tag the image with your ECR repository URL

# The URL format is: <account-id>.dkr.ecr.<region>.amazonaws.com/<repo-name>

docker tag webapp:latest 156041424020.dkr.ecr.us-east-1.amazonaws.com/modeller-repo-616f7bc:latest

# 4. Push the image

docker push 156041424020.dkr.ecr.us-east-1.amazonaws.com/modeller-repo-616f7bc:latest

## Debuging

Remember that lambda@edge functions create logs in the closest region to you.
