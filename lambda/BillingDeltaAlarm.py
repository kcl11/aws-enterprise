'''
To use this blueprint, your function's role must have permissions
to call cloudwatch:GetMetricStatistics.
For these permissions, you must specify "Resource": "*".

Example:
{
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Action": [
            "cloudwatch:GetMetricStatistics",
            "cloudwatch:PutMetricData"
        ],
        "Resource": "*"
    }]
}

'''

from datetime import datetime, timedelta

import boto3

cw = boto3.client('cloudwatch')
billing_delta = 0
last_x_hours = 12 #recommended minimum

def put_cloudwatch_metric(metric_name, value):
    cw.put_metric_data(
        Namespace='AWS/Billing',
        MetricData=[{
            'MetricName': metric_name,
            'Value': value
        }]
    )
    
def lambda_handler(event, context):
    estimated_billings = []
    
    if last_x_hours < 8:
        raise ValueError('The last_x_hours variable must be greater than 8 hours.')
    
    print(datetime.now())

    # get estimated AWS charges from past x hours
    # http://boto3.readthedocs.io/en/latest/reference/services/cloudwatch.html#CloudWatch.Client.get_metric_statistics
    response = cw.get_metric_statistics(
        Namespace = 'AWS/Billing',
        MetricName = 'EstimatedCharges',
        Dimensions = [
           {
              'Name': 'Currency',
              'Value': 'USD'
            }
        ],
        StartTime = datetime.now() - timedelta(hours=last_x_hours),
        EndTime = datetime.now(),
        Period = 14400, # 4 hours is the smallest interval for estimated billing metric
        Statistics = ['Maximum']
    )

    # response -> dictionary & response.get('Datapoints') -> list
    data_points = response.get('Datapoints')

    for data in data_points:
        print(data)
        estimated_billings.append(data.get('Maximum'))

    billing_delta = max(estimated_billings) - min(estimated_billings)
    print(billing_delta)
    
    put_cloudwatch_metric('BillingDelta', billing_delta)

    return billing_delta
