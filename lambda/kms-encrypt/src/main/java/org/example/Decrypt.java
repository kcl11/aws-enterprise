package org.example;

import com.amazonaws.services.kms.AWSKMSClient;
import com.amazonaws.services.kms.model.DecryptRequest;
import com.amazonaws.services.lambda.runtime.Context;

import java.nio.ByteBuffer;
import java.util.Base64;

/**
 * Lambda config handler => org.example.Decrypt::myHandler
 *
 */
public class Decrypt {

    AWSKMSClient kms = new AWSKMSClient()
            .withEndpoint("https://kms.us-east-1.amazonaws.com");

    public String myHandler(String ciphertext, Context context) {
        final byte[] decodedCipher = Base64.getDecoder().decode(ciphertext);
        ByteBuffer cipherBytes = ByteBuffer.wrap(decodedCipher);

        DecryptRequest req = new DecryptRequest()
                .withCiphertextBlob(cipherBytes);
        ByteBuffer plainBytes = kms.decrypt(req).getPlaintext();

        return new String(plainBytes.array());
    }

}
