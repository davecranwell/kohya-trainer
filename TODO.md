-   [x] fix deleting unused gpus not working because we're searching our database for Ids but giving instanceIds in the query
-   [x] Filter SSE by the user
-   [x] Limit number of images uploaded per training
-   [x] prevent duplicate image upload
-   [x] Do infra as code with pulumi
-   [ ] fix --headless handle which is causing bug in docker on vast. Might have alreayd fixed this?
-   [ ] Limit filesize of individual training images
-   [ ] Allow training images to be deleted
-   [x] Create a lambda which zips a buckets contents
-   [ ] Convert S3 upload process to use signed urls and front-end upload
-   [x] Vast instance configuration needs to pass webhook secret & URL
-   [ ] Vast instance configuration needs to pass presigned url for S3 images
-   [ ] kohya API must do downloading of image zip

## Pre launch

-   [ ] Add HTTPS

## Post launch

-   [ ] Allow choosing of base model from civitai API
