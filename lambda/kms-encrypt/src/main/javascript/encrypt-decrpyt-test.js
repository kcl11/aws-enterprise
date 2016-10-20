/*
This is AWS lambda blueprint for testing KMS encrypt & decrypt functions.
It also shows how to invoke Lambda functions from your code via AWS SDK.

http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#invoke-property

An example of required IAM permission:
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lambda:InvokeFunction"
            ],
            "Resource": [
                "arn:aws:lambda:us-east-1:1234567890:function:encrypt",
                "arn:aws:lambda:us-east-1:1234567890:function:decrypt"
            ]
        }
    ]
}
*/
'use strict';

let aws = require('aws-sdk');
let lambda = new aws.Lambda({ apiVersion: '2015-10-01' });

exports.handler = (event, context, callback) => {

    var input = JSON.stringify('secret config value');

    var encryptParams = {
      FunctionName: 'encrypt',
      Payload: input
    };

    lambda.invoke(encryptParams, function(err, data) {
      if (err)
          console.log(err, err.stack);
      else {
          console.log(data);

          var decryptParams = {
            FunctionName: 'decrypt',
            Payload: data.Payload
          };

          lambda.invoke(decryptParams, function(err, data) {
            if (err)
                console.log(err, err.stack);
            else {
                console.log(data);
                console.log(data.Payload); // need to handle superfluous double quotes

                callback(null, data.Payload == input);
            }
          });
      }
    });

};