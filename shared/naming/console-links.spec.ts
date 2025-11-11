import { describe, expect, test } from 'bun:test';
import { consoleLinks } from './console-links';

describe('console-links', () => {
  const testRegion = 'us-east-1';
  const testAccountId = '123456789012';

  describe('stackUrl', () => {
    test('should generate CloudFormation stack info URL', () => {
      const stackId = 'arn:aws:cloudformation:us-east-1:123456789012:stack/my-stack/abc123';
      const url = consoleLinks.stackUrl(testRegion, stackId, 'stackInfo');
      expect(url).toContain('cloudformation');
      expect(url).toContain('stackInfo');
      expect(url).toContain(encodeURIComponent(stackId));
    });

    test('should generate resources tab URL', () => {
      const stackId = 'stack-id';
      const url = consoleLinks.stackUrl(testRegion, stackId, 'resources');
      expect(url).toContain('resources');
    });

    test('should generate events tab URL', () => {
      const stackId = 'stack-id';
      const url = consoleLinks.stackUrl(testRegion, stackId, 'events');
      expect(url).toContain('events');
    });

    test('should encode stack ID in URL', () => {
      const stackId = 'arn:aws:cloudformation:region:account:stack/name/id';
      const url = consoleLinks.stackUrl(testRegion, stackId, 'stackInfo');
      expect(url).toContain(encodeURIComponent(stackId));
    });
  });

  describe('changeSetUrl', () => {
    test('should generate change set URL', () => {
      const stackId = 'stack-id';
      const changeSetId = 'changeset-id';
      const url = consoleLinks.changeSetUrl(testRegion, stackId, changeSetId);
      expect(url).toContain('cloudformation');
      expect(url).toContain('changesets');
      expect(url).toContain(encodeURIComponent(stackId));
      expect(url).toContain(encodeURIComponent(changeSetId));
    });

    test('should encode both stack ID and change set ID', () => {
      const stackId = 'arn:aws:cf:region:account:stack/name/id';
      const changeSetId = 'arn:aws:cf:region:account:changeSet/name/id';
      const url = consoleLinks.changeSetUrl(testRegion, stackId, changeSetId);
      expect(url).toContain(encodeURIComponent(stackId));
      expect(url).toContain(encodeURIComponent(changeSetId));
    });
  });

  describe('secretUrl', () => {
    test('should generate Secrets Manager secret URL', () => {
      const secretName = 'my-secret';
      const url = consoleLinks.secretUrl(testRegion, secretName);
      expect(url).toContain('secretsmanager');
      expect(url).toContain('secret');
      expect(url).toContain(secretName);
    });

    test('should handle different regions', () => {
      const url1 = consoleLinks.secretUrl('us-east-1', 'secret');
      const url2 = consoleLinks.secretUrl('eu-west-1', 'secret');
      expect(url1).toContain('us-east-1');
      expect(url2).toContain('eu-west-1');
    });
  });

  describe('createCertificateUrl', () => {
    test('should return us-east-1 URL for CDN certificates', () => {
      const url = consoleLinks.createCertificateUrl('cdn', 'eu-west-1');
      expect(url).toContain('us-east-1');
      expect(url).toContain('acm');
      expect(url).toContain('certificates/request');
    });

    test('should return regional URL for non-CDN certificates', () => {
      const url = consoleLinks.createCertificateUrl('http-api-gateway', 'eu-west-1');
      expect(url).toContain('eu-west-1');
      expect(url).toContain('acm');
      expect(url).toContain('certificates/request');
    });

    test('should use correct region for load balancer certificates', () => {
      const url = consoleLinks.createCertificateUrl('load-balancer', 'ap-south-1');
      expect(url).toContain('ap-south-1');
      expect(url).not.toContain('us-east-1');
    });
  });

  describe('budgetDailyBreakdownUrl', () => {
    test('should generate budget daily breakdown URL', () => {
      const hash = 'abc123def456';
      const url = consoleLinks.budgetDailyBreakdownUrl(hash);
      expect(url).toContain('cost-management');
      expect(url).toContain('groupBy=Service');
      expect(url).toContain('granularity=Daily');
      expect(url).toContain(hash);
    });

    test('should include stack hash in filter', () => {
      const hash = 'unique-hash-123';
      const url = consoleLinks.budgetDailyBreakdownUrl(hash);
      expect(url).toContain(hash);
      expect(url).toContain('TagKeyValue');
    });
  });

  describe('logGroup', () => {
    test('should generate log group URL', () => {
      const logGroupName = '/aws/lambda/my-function';
      const url = consoleLinks.logGroup(testRegion, logGroupName);
      expect(url).toContain('cloudwatch');
      expect(url).toContain('logsV2');
      expect(url).toContain('log-groups');
    });

    test('should double encode log group name', () => {
      const logGroupName = '/aws/lambda/function';
      const url = consoleLinks.logGroup(testRegion, logGroupName);
      const doubleEncoded = encodeURIComponent(encodeURIComponent(logGroupName));
      expect(url).toContain(doubleEncoded);
    });
  });

  describe('logStream', () => {
    test('should generate log stream URL', () => {
      const logGroupName = '/aws/lambda/function';
      const logStreamName = '2024/01/01/[$LATEST]abc123';
      const url = consoleLinks.logStream(testRegion, logGroupName, logStreamName);
      expect(url).toContain('cloudwatch');
      expect(url).toContain('log-events');
    });

    test('should encode both log group and stream names', () => {
      const logGroupName = '/aws/ecs/service';
      const logStreamName = 'container/task/id';
      const url = consoleLinks.logStream(testRegion, logGroupName, logStreamName);
      expect(url).toContain(encodeURIComponent(encodeURIComponent(logGroupName)));
      expect(url).toContain(encodeURIComponent(encodeURIComponent(logStreamName)));
    });
  });

  describe('route53HostedZone', () => {
    test('should generate Route53 hosted zone URL', () => {
      const zoneId = 'Z1234567890ABC';
      const url = consoleLinks.route53HostedZone(zoneId);
      expect(url).toContain('route53');
      expect(url).toContain('hostedzones');
      expect(url).toContain(zoneId);
    });

    test('should link to ListRecordSets view', () => {
      const url = consoleLinks.route53HostedZone('Z12345');
      expect(url).toContain('ListRecordSets');
    });
  });

  describe('createSesIdentity', () => {
    test('should generate SES create identity URL', () => {
      const url = consoleLinks.createSesIdentity(testRegion);
      expect(url).toContain('ses');
      expect(url).toContain('verified-identities/create');
      expect(url).toContain(testRegion);
    });

    test('should respect different regions', () => {
      const url = consoleLinks.createSesIdentity('eu-west-1');
      expect(url).toContain('eu-west-1');
    });
  });

  describe('cloudwatchAlarm', () => {
    test('should generate CloudWatch alarm URL', () => {
      const alarmName = 'high-cpu-alarm';
      const url = consoleLinks.cloudwatchAlarm(testRegion, alarmName);
      expect(url).toContain('cloudwatch');
      expect(url).toContain('alarmsV2');
      expect(url).toContain(alarmName);
    });

    test('should handle different alarm names', () => {
      const names = ['alarm-1', 'alarm-2', 'custom-alarm'];
      names.forEach((name) => {
        const url = consoleLinks.cloudwatchAlarm(testRegion, name);
        expect(url).toContain(name);
      });
    });
  });

  describe('cloudwatchAlbDashboard', () => {
    test('should generate ALB dashboard URL', () => {
      const url = consoleLinks.cloudwatchAlbDashboard(testRegion);
      expect(url).toContain('cloudwatch');
      expect(url).toContain('dashboards');
      expect(url).toContain('ApplicationELB');
    });
  });

  describe('codebuildDeployment', () => {
    test('should generate CodeBuild deployment URL', () => {
      const projectName = 'my-project';
      const buildId = 'build-123';
      const url = consoleLinks.codebuildDeployment(testRegion, testAccountId, projectName, buildId);
      expect(url).toContain('codebuild');
      expect(url).toContain(projectName);
      expect(url).toContain(buildId);
      expect(url).toContain(testAccountId);
    });

    test('should include log path', () => {
      const url = consoleLinks.codebuildDeployment(testRegion, testAccountId, 'proj', 'build');
      expect(url).toContain('log');
    });
  });

  describe('snsTopic', () => {
    test('should generate SNS topic URL', () => {
      const topicName = 'my-topic';
      const url = consoleLinks.snsTopic(testRegion, testAccountId, topicName);
      expect(url).toContain('sns');
      expect(url).toContain('topic');
      expect(url).toContain('arn:aws:sns');
    });

    test('should construct ARN correctly', () => {
      const url = consoleLinks.snsTopic('us-west-2', '999888777666', 'test-topic');
      expect(url).toContain('us-west-2');
      expect(url).toContain('999888777666');
      expect(url).toContain('test-topic');
    });
  });

  describe('eventBus', () => {
    test('should generate EventBridge event bus URL', () => {
      const busName = 'my-event-bus';
      const url = consoleLinks.eventBus(testRegion, busName);
      expect(url).toContain('events');
      expect(url).toContain('eventbus');
      expect(url).toContain(busName);
    });
  });

  describe('sqsQueue', () => {
    test('should generate SQS queue URL', () => {
      const queueName = 'my-queue';
      const url = consoleLinks.sqsQueue(testRegion, testAccountId, queueName);
      expect(url).toContain('sqs');
      expect(url).toContain('queues');
      expect(url).toContain(queueName);
    });

    test('should encode queue URL', () => {
      const url = consoleLinks.sqsQueue('us-east-1', '123456789012', 'test-queue');
      expect(url).toContain('sqs.us-east-1.amazonaws.com');
      expect(url).toContain(encodeURIComponent('https://'));
    });
  });

  describe('firewallMetrics', () => {
    test('should generate WAF metrics URL', () => {
      const url = consoleLinks.firewallMetrics({ region: testRegion });
      expect(url).toContain('cloudwatch');
      expect(url).toContain('metricsV2');
      expect(url).toContain('WAFV2');
    });

    test('should include region', () => {
      const url = consoleLinks.firewallMetrics({ region: 'eu-central-1' });
      expect(url).toContain('eu-central-1');
    });
  });

  describe('s3Object', () => {
    test('should generate S3 object URL', () => {
      const bucketName = 'my-bucket';
      const objectKey = 'path/to/object.txt';
      const url = consoleLinks.s3Object({ bucketName, objectKey });
      expect(url).toContain('s3');
      expect(url).toContain('object');
      expect(url).toContain(bucketName);
      expect(url).toContain(`prefix=${objectKey}`);
    });

    test('should handle nested object paths', () => {
      const url = consoleLinks.s3Object({
        bucketName: 'bucket',
        objectKey: 'folder/subfolder/file.json'
      });
      expect(url).toContain('folder/subfolder/file.json');
    });
  });

  describe('ecsTask', () => {
    test('should generate ECS task URL', () => {
      const url = consoleLinks.ecsTask({
        clusterName: 'my-cluster',
        taskId: 'abc123',
        region: testRegion,
        selectedContainer: 'app'
      });
      expect(url).toContain('ecs');
      expect(url).toContain('clusters/my-cluster');
      expect(url).toContain('tasks/abc123');
      expect(url).toContain('selectedContainer=app');
    });

    test('should include all required parameters', () => {
      const url = consoleLinks.ecsTask({
        clusterName: 'cluster-1',
        taskId: 'task-1',
        region: 'eu-west-1',
        selectedContainer: 'container-1'
      });
      expect(url).toContain('cluster-1');
      expect(url).toContain('task-1');
      expect(url).toContain('eu-west-1');
      expect(url).toContain('container-1');
    });

    test('should link to configuration tab', () => {
      const url = consoleLinks.ecsTask({
        clusterName: 'c',
        taskId: 't',
        region: 'r',
        selectedContainer: 'sc'
      });
      expect(url).toContain('configuration');
    });
  });

  describe('URL format consistency', () => {
    test('all URLs should be valid HTTPS URLs', () => {
      const urls = [
        consoleLinks.stackUrl('us-east-1', 'stack-id', 'stackInfo'),
        consoleLinks.secretUrl('us-east-1', 'secret'),
        consoleLinks.logGroup('us-east-1', '/aws/lambda/fn'),
        consoleLinks.cloudwatchAlarm('us-east-1', 'alarm')
      ];

      urls.forEach((url) => {
        expect(url).toStartWith('https://');
        expect(() => new URL(url)).not.toThrow();
      });
    });

    test('URLs should contain region when applicable', () => {
      const url = consoleLinks.secretUrl('ap-southeast-2', 'secret');
      expect(url).toContain('ap-southeast-2');
    });
  });
});
