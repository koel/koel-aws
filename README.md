# Koel-AWS

The official package and guide to use AWS S3 with [Koel](https://github.com/phanan/koel).

## How It Works

The easiest way to understand the approach is to take a look at my awesomely-drawn diagram:

![Diagram](https://cdn.rawgit.com/phanan/koel-aws/master/assets/diagram.svg?v2)

## Supports, Requirements and Assumptions

As of current, only `mp3`, `ogg`, and `m4a` files are supported. Also, your Koel installation will need to be on `master` branch (the next major version will support this feature by default).

Though I'll try to make the instructions as detailed as possible, you're expected to know your way around AWS's console, which, let's be honest here, can use some UX improvements. If you're stuck with a AWS-specific command, Google is your friend. Seriously, don't open an issue asking what Lambda is, or how to create an IAM user.

## Step-by-Step Installation

### 1. Prepare S3 for streaming

1. Create an IAM user, e.g. `koel-user`
1. Create a bucket, e.g. `koel-bucket`
1. Make sure `koel-user` can read `koel-bucket`'s  content. You can simply attach the `AmazonS3ReadOnlyAccess` policy to `koel-user`.
1. Allow CORS on `koel-bucket`

    ```markup
    <CORSConfiguration>
        <CORSRule>
            <AllowedOrigin>*</AllowedOrigin>
            <AllowedMethod>GET</AllowedMethod>
            <MaxAgeSeconds>3000</MaxAgeSeconds>
            <AllowedHeader>Authorization</AllowedHeader>
        </CORSRule>
    </CORSConfiguration>
    ```

### 2. Configure Lambda for syncing

1. Checkout this repository: `git clone https://github.com/phanan/koel-aws`
2. Install necessary packages: `cd koel-aws && npm install --production`
3. Copy `.env.example` into `.env` and edit the variables there
4. Zip the whole directory's content into something like `archive.zip`
5. In AWS Lambda console, create a Lambda function with the following information (**IMPORTANT:** Make sure you're creating the function in the same region with `koel-bucket`)

    ```
    Name: koel-lambda
    Runtime: Node.js 4.3
    Code entry type: Upload a .ZIP file (you'll upload the zip file created in step 4 here)
    Handler: index.handler
    Role: S3 execution role (a new window will appear, where you can just click next next and next)
    Memory (MB): 128 should be fine
    Timeout: 0min 10sec
    VPC: "No VPC" should be fine
    ```

### 3. Configure S3 to send events to Lambda

Under `koel-bucket` "Events" section, create an event with the following details:

    Name: <Just leave it blank>
    Events: ObjectCreated(All), ObjectRemoved(All)
    Prefix: <Empty>
    Suffix: <Empty>
    Send To: Lambda function
    Lambda function: koel-lambda

### 4. Configure Koel to be able to stream from S3

If everything works properly (and it should!) you can now upload media files to the bucket and they should appear in Koel. To play them, just populate `koel-user`'s `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` into your Koel's `.env` file.

### 5. ☕️

You've made it! Now go make some coffee, lay back, and enjoy some melodies.

## Contribution

I'm not an AWS expert, nor do I ever want to be one. If you spot any problem with the code or have a better idea, please let me know.

## License

MIT © Phan An
