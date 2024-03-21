/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 * 定义arrayMethods对象，用于增强Array.prototype
 * 党访问arrayMethods对象上的7个方法时会被拦截，用来实现响应式
 */

import { TriggerOpTypes } from '../../v3'
import { def } from '../util/index'

// 备份数组原型对象
const arrayProto = Array.prototype
// 通过继承的方式创建新的arrayMethods
export const arrayMethods = Object.create(arrayProto)

// 操作数组的7个方法，他们可以改变自身数组
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 拦截变异方法并触发事件
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 缓存原生的方法
  const original = arrayProto[method]
  // def就是Object.defineProperty,拦截arrayMethods.method的访问
  def(arrayMethods, method, function mutator(...args) {
    // 执行原生方法 如push.apply(this,args)
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    // 以下三个方法插入元素
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 对新插入的元素做响应式处理
    if (inserted) ob.observeArray(inserted)
    // notify change
  // 通知更新
    if (__DEV__) {
      ob.dep.notify({
        type: TriggerOpTypes.ARRAY_MUTATION,
        target: this,
        key: method
      })
    } else {
      ob.dep.notify()
    }
    return result
  })
})
