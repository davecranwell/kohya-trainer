# Overall app flow

```mermaid
sequenceDiagram
    participant User
    participant Task
    participant S3
    participant Vast
    participant Civitai

    User->>S3: Uploads training images
    User->>Task: [Task: allocateGpu] Triggers training start
    activate Vast
    Task->>Vast: Starts GPU instance
    Task->>Vast: Uploads training config inc S3 URL of images and signed URL to upload best model at the end
    Vast->>Task: [Webhook] Confirms images uploaded
    Vast->>Civitai: [fetchModel]  Pulls model
    Vast->>S3: [fetchImages] Pulls training images from S3
    loop Progress reports
        Vast->>Vast: Trains
        Vast->>User: Progress reports via Webhook
    end
    Vast->>S3: Uploads lowest loss trained model
    Vast->>User: Training completes via Webhook
    Task->>Vast: [Task: deallocateGpu] Stops GPU instance
    deactivate Vast
    User->>S3: Downloads trained model
```

Training statuses:

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> stalled
    pending --> pendingGpu
    pendingGpu --> pendingImages
    pendingGpu --> stalled
    pendingImages --> pendingModel
    pendingImages --> stalled
    pendingModel --> training
    pendingModel --> stalled
    training --> completed
    training --> stalled
    completed --> [*]
```

All the things that must happen before training can begin

-   User must have uploaded all their images
-   A zip must have been created of all those images
-   The GPU must be allocated and active and must have been told
    -   the presignedURL of that zip,
    -   the model to download,
    -   the civitai API key to use,
    -   the model's config, and
    -   the URL & signing secret of the webhook to use
    -   [webhook callback when kohya is ready & installed, or perhaps when API starts]
-   The GPU must have downloaded
    -   the zip [webhook callback after it's been unzipped]
    -   the model, and [webhook callback after it's been downloaded]
    -   must have put the config the zip and the model in the expected places [webhook callback when everything is ready]

As a results we have several indicators of readiness, each a webhook callback:

-   The GPU is ready
-   The GPU has downloaded the zip
-   The GPU has downloaded the model
-   The GPU has positioned everything correctly

As training commences, additional callbacks are made:

-   The GPU is training at X%
-   The GPU has completed training
-   The GPU has uploaded the model to S3

# Installation of sd-scripts

On WSL ubuntu: `sudo apt-get install build-essential lzma tk-dev liblzma-dev libreadline-dev libffi-dev zlib1g zlib1g-dev libssl-dev libbz2-dev libsqlite3-dev`

Then...

```bash
cd sd-scripts

curl -L https://github.com/pyenv/pyenv-installer/raw/master/bin/pyenv-installer | bash

echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.profile
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.profile
echo 'eval "$(pyenv init -)"' >> ~/.profile

echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc

pyenv install 3.10.6
pyenv local 3.10.6

python -m venv venv
source venv/bin/activate

pip install torch==2.1.2 torchvision==0.16.2 --index-url https://download.pytorch.org/whl/cu118
pip install --upgrade -r requirements.txt
pip install xformers==0.0.23.post1 --index-url https://download.pytorch.org/whl/cu118
```
