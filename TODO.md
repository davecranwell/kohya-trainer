-   [x] fix deleting unused gpus not working because we're searching our database for Ids but giving instanceIds in the query
-   [x] Filter SSE by the user
-   [x] Limit number of images uploaded per training
-   [x] prevent duplicate image upload
-   [x] Do infra as code with pulumi
-   [x] Create a lambda which zips a buckets contents
-   [x] Vast instance configuration needs to pass webhook secret & URL
-   [x] Vast instance configuration needs to be passed presigned url for S3 images
-   [x] kohya API must do downloading of image zip
-   [x] fix --headless handle which is causing bug in docker on vast. Might have alreayd fixed this?
-   [x] Convert S3 upload process to use signed urls and front-end upload in webapp
-   [x] Allow choosing of base model from civitai API
-   [x] Build tasks that identifies stalled trainings and marks them as such
-   [ ] Limit filesize of individual training images
-   [ ] Allow training images to be deleted
-   [ ] Separate training subject type (style, man, woman, character, object, etc) from output name/trigger word
-   [ ] Ensure prisma shares pino logging with express
-   [ ] Consider safety mechanisms like always enforcing training word "woman", "man" instead of "girl" or "child"

## Pre launch

-   [ ] Add HTTPS

## Post launch
