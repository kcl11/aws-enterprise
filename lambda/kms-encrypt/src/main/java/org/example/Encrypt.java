package org.example;

import com.amazonaws.services.kms.AWSKMSClient;
import com.amazonaws.services.kms.model.*;
import com.amazonaws.services.lambda.runtime.Context;

import java.nio.ByteBuffer;
import java.util.Base64;

/**
 * TODO: add IAM & KMS setup && org.example.Encrypt::myHandler
 * <p>
 * https://docs.aws.amazon.com/java-sdk/latest/developer-guide/setup-project-maven.html
 * http://docs.aws.amazon.com/kms/latest/developerguide/workflow.html
 * http://docs.aws.amazon.com/kms/latest/developerguide/programming-encryption.html
 */
public class Encrypt {
    String keyARN = "KMS key ARN here";

    //http://amzn.to/1mKTMmG
    AWSKMSClient kms = new AWSKMSClient()
            .withEndpoint("https://kms.us-east-1.amazonaws.com");

    public String myHandler(String plaintext, Context context) {
        ByteBuffer plainBytes = ByteBuffer.wrap(plaintext.getBytes());

        EncryptRequest req = new EncryptRequest().withKeyId(keyARN).withPlaintext(plainBytes);
        ByteBuffer cipherBytes = kms.encrypt(req).getCiphertextBlob();

        //http://www.joelonsoftware.com/articles/Unicode.html
        return Base64.getEncoder().encodeToString(cipherBytes.array());
    }
}


