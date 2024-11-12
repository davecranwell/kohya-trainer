# Usage

```bash
aws configure sso
```

SSO session name: davecranwell
CLI default client region: us-east-1

```bash
aws sso login --sso-session=davecranwell
pulumi up
```

## Destroying

```bash
pulumi destroy
```

## Debuging

Remember that lambda@edge functions create logs in the closest region to you.
