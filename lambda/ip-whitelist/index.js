'use strict';

let aws = require('aws-sdk');
let ec2 = new aws.EC2({
    apiVersion: '2015-10-01'
});

let GitHubApi = require('github');
let github = new GitHubApi({
    version: '3.0.0'
});

// security groups to be whitelisted
let securityGroups = [];
// truth table for whitelisted CidrIps
let truthFile = '';
// github access token
let gitAccessToken = '';
let gitUsername = '';
let gitRepo = '';
let branch = 'master';

exports.handler = (event, context, callback) => {
    //console.log('Received GitHub event:', JSON.stringify(event, null, 2));

    var snsMsg = event.Records[0].Sns.Message;
    console.log('Received SNS message:', snsMsg);

    // assume truth file is the only file in the commit
    var modified = JSON.parse(snsMsg)['commits'][0]['modified'][0];

    if (modified && modified == truthFile) {
        // authenticate
        github.authenticate({
            type: 'oauth',
            token: gitAccessToken
        });

        // http://mikedeboer.github.io/node-github/#repos.prototype.getContent
        github.repos.getContent({
            user: gitUsername,
            repo: gitRepo,
            path: truthFile,
            ref: branch
        }, function(err, data) {
            if (err) throw err; // an error occurred
            else { // successful response

                var content = new Buffer(data.content, 'base64').toString("utf8");
                var json = JSON.parse(content);

                var truthCidrIps = Object.keys(json)
                console.log('truth file:', json);

                for (var sg in securityGroups) {
                    var params = {
                        Filters: [{
                            Name: 'group-id',
                            Values: [securityGroups[sg]]
                        }]
                    };

                    ec2.describeSecurityGroups(params, (err, data) => {
                        if (err) throw err; // an error occurred
                        else { // successful response
                            var http = [];
                            var https = [];
                            var http_to_add = [];
                            var https_to_add = [];
                            var ips_to_add = [];
                            var ip_permissions = data.SecurityGroups[0]['IpPermissions'];

                            // get current whitelisted CIDRs for http & https protocols
                            for (var i in ip_permissions) {
                                var fromPort = ip_permissions[i]['FromPort'];
                                var toPort = ip_permissions[i]['ToPort'];

                                if (fromPort == 80 && toPort == 80) {
                                    for (var j in ip_permissions[i]['IpRanges']) {
                                        http.push(ip_permissions[i]['IpRanges'][j]['CidrIp']);
                                    }
                                    console.log('http CidrIps:', http);
                                } else if (fromPort == 443 && toPort == 443) {
                                    for (var k in ip_permissions[i]['IpRanges']) {
                                        https.push(ip_permissions[i]['IpRanges'][k]['CidrIp']);
                                    }
                                    console.log('https CidrIps:', https);
                                }
                            } // end for

                            // construct the new CIDR's to add to http & https protocols
                            for (var idx in truthCidrIps) {
                                if (http.indexOf(truthCidrIps[idx]) < 0) {
                                    http_to_add.push({
                                        CidrIp: truthCidrIps[idx]
                                    });
                                }
                                if (https.indexOf(truthCidrIps[idx]) < 0) {
                                    https_to_add.push({
                                        CidrIp: truthCidrIps[idx]
                                    });
                                }
                            } //end for

                            if (http_to_add.length > 0) {
                                ips_to_add.push({
                                    FromPort: 80,
                                    ToPort: 80,
                                    IpProtocol: 'tcp',
                                    IpRanges: http_to_add
                                })
                            }
                            if (https_to_add.length > 0) {
                                ips_to_add.push({
                                    FromPort: 443,
                                    ToPort: 443,
                                    IpProtocol: 'tcp',
                                    IpRanges: https_to_add
                                })
                            }

                            // add new CidrIps to each security group
                            if (ips_to_add.length > 0) {
                                var params = {
                                    GroupId: securityGroups[sg],
                                    IpPermissions: ips_to_add
                                };

                                // NOTE: You can have up to 50 rules per security group
                                ec2.authorizeSecurityGroupIngress(params, function(err, data) {
                                    if (err) throw err; // an error occurred
                                    else console.log('success:', data); // successful response
                                });
                            } //end if
                        }
                    });
                }
            }
        });
    } //end if

    callback(null, snsMsg);
};
