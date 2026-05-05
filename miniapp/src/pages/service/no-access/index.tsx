import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';

export default function ServiceNoAccessPage() {
  const reason = Taro.getCurrentInstance().router?.params?.reason;
  const rejected = reason === 'rejected';

  return (
    <View className='auth-flow-page auth-flow-page--service'>
      <View className='auth-topbar'>
        <Text className='auth-back' onClick={() => Taro.redirectTo({ url: '/pages/role/index' })}>‹</Text>
        <Text className='auth-topbar__title'>权限提示</Text>
        <Text className='auth-topbar__space' />
      </View>

      <View className='auth-status-card auth-status-card--top auth-status-card--warning'>
        <View className='auth-status-pill auth-status-pill--warning'>{rejected ? '未通过' : '未认证'}</View>
        <Text className='auth-title'>暂无服务协同端权限</Text>
        <Text className='auth-desc'>
          {rejected
            ? '当前服务人员认证未通过，请联系所属机构管理员核对资料后重新提交。'
            : '服务协同端仅限认证服务人员使用，请先完成机构认证。'}
        </Text>
      </View>

      <View className='auth-support-card'>
        <View className='auth-support-row'>
          <Text className='auth-support-index'>限</Text>
          <Text>服务协同端包含工单、随访和个案信息，仅开放给认证人员。</Text>
        </View>
        <View className='auth-support-row'>
          <Text className='auth-support-index'>审</Text>
          <Text>{rejected ? '重新提交后将再次进入审核流程。' : '提交认证后，请等待所属机构审核。'}</Text>
        </View>
      </View>

      <View className='auth-action-panel'>
        <Button
          className='service-button service-button--primary'
          onClick={() => Taro.redirectTo({ url: '/pages/service/certification/index' })}
        >
          {rejected ? '重新提交认证' : '去认证'}
        </Button>
        <Button className='service-button service-button--ghost' onClick={() => Taro.redirectTo({ url: '/pages/role/index' })}>
          返回身份选择
        </Button>
      </View>
    </View>
  );
}
