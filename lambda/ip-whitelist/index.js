/*
IP whitelisting is a common practice for securing your internal-facing apps or tools hosted in the cloud. This Lambda blueprint automates the whitelisting process, enabling developers to whitelist IPs themselves and notifying production/security engineers. The whitelisted IPs are captured in a JSON file (a.k.a. truth file) in GitHub, access and version controlled.

Setup:
1) Create and add your JSON/truth file to repository

 {
   "CIDR": "what for",
   "192.168.0.1/32": "myofficeIp"
 }

2) Go through steps 1 to 6 in https://aws.amazon.com/blogs/compute/dynamic-github-actions-with-aws-lambda/

3) For step 7:
 install npm - https://docs.npmjs.com/getting-started/installing-node
 add this index.js and update the config section

Future enhancements:
1) Add basic safeguards, such as checking for 0.0.0.0/0
2) Add support for un-whitelisting or IPs removal
3) Add support for other protocols; default only http(s)
4) Add support for attaching expiration to whitelisted IP
*/

'use strict';

let aws = require('aws-sdk');
let GithubApi = require('github');

let ec2 = new aws.EC2({ apiVersion: '2015-10-01' });
let github = new GithubApi({ version: '3.0.0' });

// --- CONFIG ---
// CAREFUL HERE WHEN WORKING WITH PUBLIC REPO
let truthFile = ''; // path + file name

let securityGroups = ['']; // to be used for whitelisting

let gitAccessToken = '';
let gitUsername = '';
let gitRepo = '';
let gitBranch = '';
// --- end CONFIG ---

exports.handler = (event, context, callback) => {
    //console.log('Received GitHub event:', JSON.stringify(event, null, 2));

    var snsMsg = event.Records[0].Sns.Message;
    //console.log('Received SNS message:', snsMsg);

    // assume truth file is the only file in the commit
    var modified = JSON.parse(snsMsg)['commits'][0]['modified'][0];

    if (modified && modified == truthFile) {
        github.authenticate({
            type: 'oauth',
            token: gitAccessToken
        });

        github.repos.getContent({
            user: gitUsername,
            repo: gitRepo,
            path: truthFile,
            ref: gitBranch
        }, function(err, data) {
            if (err) throw err;
            else {
                // http://mikedeboer.github.io/node-github/#repos.prototype.getContent
                var content = new Buffer(data.content, 'base64').toString("utf8");
                var json = JSON.parse(content);

                var truthIps = Object.keys(json);
                console.log('truth file:', json);

                for (var sg in securityGroups) {
                    var params = {
                        Filters: [{
                            Name: 'group-id',
                            Values: [securityGroups[sg]]
                        }]
                    };

                    ec2.describeSecurityGroups(params, function(err, data) {
                        if (err) throw err;
                        else {
                            var http = [];
                            var https = [];
                            var http_to_add = [];
                            var https_to_add = [];
                            var ips_to_add = [];
                            var ip_permissions = data.SecurityGroups[0]['IpPermissions'];

                            // get current whitelisted IPs for http & https
                            for (var i in ip_permissions) {
                                var fromPort = ip_permissions[i]['FromPort'];
                                var toPort = ip_permissions[i]['ToPort'];

                                if (fromPort == 80 && toPort == 80) {
                                    for (var j in ip_permissions[i]['IpRanges']) {
                                        http.push(ip_permissions[i]['IpRanges'][j]['CidrIp']);
                                    }
                                } else if (fromPort == 443 && toPort == 443) {
                                    for (var k in ip_permissions[i]['IpRanges']) {
                                        https.push(ip_permissions[i]['IpRanges'][k]['CidrIp']);
                                    }
                                }
                            }

                            // construct the new IPs to add to http & https protocols
                            for (var idx in truthIps) {
                                if (http.indexOf(truthIps[idx]) < 0) {
                                    http_to_add.push({
                                        CidrIp: truthIps[idx]
                                    });
                                }
                                if (https.indexOf(truthIps[idx]) < 0) {
                                    https_to_add.push({
                                        CidrIp: truthIps[idx]
                                    });
                                }
                            }

                            console.log('http_to_add', http_to_add);
                            console.log('https_to_add', https_to_add);

                            if (http_to_add.length > 0) {
                                ips_to_add.push({
                                    FromPort: 80,
                                    ToPort: 80,
                                    IpProtocol: 'tcp',
                                    IpRanges: http_to_add
                                });
                            }
                            if (https_to_add.length > 0) {
                                ips_to_add.push({
                                    FromPort: 443,
                                    ToPort: 443,
                                    IpProtocol: 'tcp',
                                    IpRanges: https_to_add
                                });
                            }

                            // add new IPs to the security group
                            if (ips_to_add.length > 0) {
                                var params = {
                                    GroupId: securityGroups[sg],
                                    IpPermissions: ips_to_add
                                };

                                // NOTE: there is max of 50 rules per VPC security group
                                ec2.authorizeSecurityGroupIngress(params, function(err, data) {
                                    if (err) throw err;
                                    else console.log('success:', data);
                                });
                            }

                        }
                    });

                } //end for

            }
        });

    } //end if

    callback(null, snsMsg);
};
