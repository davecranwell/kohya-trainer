
* Creates a unique Id for each model trained
* Uses the same ID in the uploads to S3 to keep training images separated
* Training ID stored in session and eventually in DB
* When ending/aborting training you can just delete entire S3 folder by the training ID


Upload files to S3 from browser
While uploading:
    Allow user to enter prompts for each
    (Could also wait for blip to create prompts?)
Once uploaded:
    Generate Kohya training config
    Use vast/runpod API to create an instance
    Use vast/runpod provisioning script with dynamic values to download all files just uploaded to S3, inc their captions.
    use vast/runpod api to periodically check logs for provisioning status
    once ready:
        Run traninng
        Begun checking logs for details of epoch completion and loss rate
        
