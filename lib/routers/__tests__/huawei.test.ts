import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { getHuaweiDevices, RouterError } from '../huawei';

vi.mock('@/lib/config', () => ({
  routerConfig: {
    huawei: {
      ip: 'http://100.10.10.1',
      username: 'telecomadmin',
      password: 'testpw',
      timeout: 5000,
    },
  },
}));

let mockAdapter: MockAdapter;
let createdInstance: ReturnType<typeof axios.create>;

const LOGIN_PAGE = '<html><body>login</body></html>';
const WAITING_PAGE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Waiting...</title>
    <script>top.location.replace('/');</script>
  </head>
  <body></body>
</html>
`;

const AUTH_INDEX_PAGE = `
<html>
  <head><title>Index</title></head>
  <body>
    <script>$.ajax({url : "asp/getMenuArray.asp"});</script>
  </body>
</html>
`;

const LAN_DEV_INFO = `
function USERDevice(Domain,IpAddr,MacAddr,Port,IpType,DevType,DevStatus,PortType,Time,HostName,IPv4Enabled,IPv6Enabled,DeviceType,UserDevAlias,UserSpecifiedDeviceType,LeaseTimeRemaining){}
var UserDevinfo = new Array(
  new USERDevice("InternetGatewayDevice.LANDevice.1.X_HW_UserDev.1","100\\x2e10\\x2e10\\x2e24","56\\x3a33\\x3abc\\x3a88\\x3a6d\\x3a7b","SSID5","DHCP","android\\x2ddhcp\\x2d13","Online","WIFI","16\\x3a30","Syed\\x2dAjwad\\x2dshah","1","1","0","","0","199584"),
  new USERDevice("InternetGatewayDevice.LANDevice.1.X_HW_UserDev.2","100\\x2e10\\x2e10\\x2e10","a0\\x3aa3\\x3af0\\x3a8e\\x3a5d\\x3aa2","LAN1","DHCP","","Online","ETH","99\\x3a27","","1","1","0","DLINK","5","160366"),
  new USERDevice("InternetGatewayDevice.LANDevice.1.X_HW_UserDev.3","100\\x2e10\\x2e10\\x2e78","a6\\x3a31\\x3a58\\x3a67\\x3a71\\x3ada","SSID5","DHCP","android\\x2ddhcp\\x2d16","Offline","WIFI","91\\x3a59","Phone","1","1","0","","0","0"),
null);
`;

const DHCP_INFO = `
function DHCPInfo(domain,name,ip,mac,remaintime,devtype,interfacetype,AddressSource){}
var UserDhcpinfo = new Array(
  new DHCPInfo("InternetGatewayDevice.LANDevice.1.Hosts.Host.5","Syed\\x2dAjwad\\x2dshah","100\\x2e10\\x2e10\\x2e24","56\\x3a33\\x3abc\\x3a88\\x3a6d\\x3a7b","199584","android\\x2ddhcp\\x2d13","802\\x2e11","DHCP"),
  new DHCPInfo("InternetGatewayDevice.LANDevice.1.Hosts.Host.1","","100\\x2e10\\x2e10\\x2e10","a0\\x3aa3\\x3af0\\x3a8e\\x3a5d\\x3aa2","160366","","Ethernet","DHCP"),
null);
`;

beforeEach(() => {
  createdInstance = axios.create();
  mockAdapter = new MockAdapter(createdInstance, { onNoMatch: 'throwException' });
  vi.spyOn(axios, 'create').mockReturnValue(createdInstance as ReturnType<typeof axios.create>);
});

afterEach(() => {
  mockAdapter.reset();
  vi.restoreAllMocks();
});

function mockHuaweiLoginSuccess() {
  mockAdapter.onGet('/').reply(200, LOGIN_PAGE);
  mockAdapter.onPost('/asp/GetRandCount.asp').reply(200, '\uFEFFdc8ae932c3a0c3696e8ceb03cd69a232');
  mockAdapter.onPost('/login.cgi').reply(200, WAITING_PAGE);
  mockAdapter.onGet('/index.asp').reply(200, AUTH_INDEX_PAGE);
}

describe('Huawei router integration', () => {
  it('returns RouterError(offline) when router is unreachable', async () => {
    mockAdapter.onGet('/').networkError();

    await expect(getHuaweiDevices()).rejects.toSatisfy(
      (error: RouterError) => error instanceof RouterError && error.kind === 'offline'
    );
  });

  it('returns RouterError(invalid_credentials) when login does not create a session', async () => {
    mockAdapter.onGet('/').reply(200, LOGIN_PAGE);
    mockAdapter.onPost('/asp/GetRandCount.asp').reply(200, '\uFEFFdc8ae932c3a0c3696e8ceb03cd69a232');
    mockAdapter.onPost('/login.cgi').reply(200, WAITING_PAGE);
    mockAdapter.onGet('/index.asp').reply(200, WAITING_PAGE);

    await expect(getHuaweiDevices()).rejects.toSatisfy(
      (error: RouterError) => error instanceof RouterError && error.kind === 'invalid_credentials'
    );
  });

  it('fetches and parses connected devices from authenticated GetLanUser* endpoints', async () => {
    mockHuaweiLoginSuccess();
    mockAdapter.onGet('/html/bbsp/common/GetLanUserDevInfo.asp').reply(200, LAN_DEV_INFO);
    mockAdapter.onGet('/html/bbsp/common/GetLanUserDhcpInfo.asp').reply(200, DHCP_INFO);

    const result = await getHuaweiDevices();

    expect(result.source).toBe('live');
    expect(result.router).toBe('Huawei HG8245W5');
    expect(result.deviceCount).toBe(2); // only Online entries are returned
    expect(result.devices[0].ip).toBe('100.10.10.24');
    expect(result.devices[0].mac).toBe('56:33:BC:88:6D:7B');
    expect(result.devices[0].connection).toBe('wifi');
    expect(result.devices[0].name).toBe('Syed-Ajwad-shah');
    expect(result.devices[1].connection).toBe('ethernet');
  });

  it('returns an empty list when router reports no connected users', async () => {
    mockHuaweiLoginSuccess();
    mockAdapter.onGet('/html/bbsp/common/GetLanUserDevInfo.asp').reply(200, 'var UserDevinfo = new Array(null);');
    mockAdapter.onGet('/html/bbsp/common/GetLanUserDhcpInfo.asp').reply(200, 'var UserDhcpinfo = new Array(null);');

    const result = await getHuaweiDevices();
    expect(result.deviceCount).toBe(0);
    expect(result.devices).toEqual([]);
  });

  it('throws RouterError(parse_error) when LAN payload is not parseable', async () => {
    mockHuaweiLoginSuccess();
    mockAdapter.onGet('/html/bbsp/common/GetLanUserDevInfo.asp').reply(200, '<html>unexpected</html>');
    mockAdapter.onGet('/GetLanUserDevInfo.asp').reply(404, '');

    await expect(getHuaweiDevices()).rejects.toSatisfy(
      (error: RouterError) => error instanceof RouterError && error.kind === 'parse_error'
    );
  });
});
