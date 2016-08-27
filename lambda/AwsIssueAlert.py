'''
A simple RSS parser for monitoring AWS service status (http://status.aws.amazon.com/).
Needless to say, you shouldn't use this to monitor Lambda itself. 

Warning: The xml.etree.ElementTree module is not secure against maliciously constructed data.
(See https://docs.python.org/2/library/xml.etree.elementtree.html &
https://developer.yahoo.com/python/python-xml.html)

To use this blueprint, your function's role must have permissions to call sns:publish.
Example:
{
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Action": [
            "sns:publish"
        ],
        "Resource": "YOUR_SNS_ARN"
    }]
}
'''

from xml.etree.ElementTree import parse
from datetime import datetime, timedelta

import boto3
import json
import urllib2

# ---CONFIG---
# CAREFUL HERE WHEN WORKING WITH PUBLIC REPO

FEED_URL = 'http://status.aws.amazon.com/rss/ec2-us-east-1.rss'
SNS_ARN = ''

# ---END CONFIG---

# Time zone offset table
utc_offsets = {'PDT': -7, 'PST': -8}

# NOTE: recommended interval for your Lambda schedule trigger
interval = 1

sns_client = boto3.client('sns')

def lambda_handler(event, context):
  ret = {}
  rss = parse( urllib2.urlopen( FEED_URL ) ).getroot()
  elem = rss.find('channel/item')
  # e.g. <pubDate>Sun, 14 Aug 2016 04:43:25 PDT</pubDate>
  pub_date = elem.findtext('pubDate')
  title = elem.findtext('title')

  now = datetime.now()
  now_minus = datetime.now() - timedelta( hours=interval )
  print now_minus

  # grab time zone (either PDT or PST)
  timezone = pub_date[-3:]
  time = pub_date[:-3]     
  pub_date_utc = datetime.strptime(time, '%a, %d %b %Y %H:%M:%S ') - timedelta( hours=utc_offsets[timezone] )  
  print pub_date_utc
     
  if pub_date_utc > now_minus:
    ret['default'] = FEED_URL
    response = sns_client.publish(
      TopicArn=SNS_ARN,
      MessageStructure='json',
      Subject=title,
      Message=json.dumps(ret)
    )
    print 'Thumbs down'
  else:
    print 'Thumbs up'
    
  return FEED_URL

