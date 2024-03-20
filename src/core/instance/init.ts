import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'
import type { Component } from 'types/component'
import type { InternalComponentOptions } from 'types/options'
import { EffectScope } from 'v3/reactivity/effectScope'

let uid = 0
// 定义Vue.prototype._init方法
export function initMixin(Vue: typeof Component) {
  // 负责vue的初始化调用
  Vue.prototype._init = function (options?: Record<string, any>) {
    // vue实例
    const vm: Component = this
    // a uid 每个vue都有个id,避免重复，依次递增
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to mark this as a Vue instance without having to do instanceof
    // check
    vm._isVue = true
    // avoid instances from being observed
    vm.__v_skip = true
    // effect scope
    vm._scope = new EffectScope(true /* detached */)
    // #13134 edge case where a child component is manually created during the
    // render of a parent component
    vm._scope.parent = undefined
    vm._scope._vm = true
    // merge options
    // 处理组件的配置项，
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 每个子组件走到这里，只做一次初始化性能优化
      initInternalComponent(vm, options as any)
    } else {
      /**
       * 初始化组件时走到这里，合并Vue的全局配置到根组件的局部配置，比如 Vue.component 注册的全局组件会合并到 根实例的 components 选项中
       * 每个子组件合并发生在两个地方：
       *  1、Vue.component方法注册的全局组件在注册时做了合并选项
       *  2、{ components: { xx } } 方式注册的局部组件在执行编译器生成的 render 函数时做了选项合并，包括根组件中的 components 配置
       */
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor as any),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (__DEV__) {
      // 设置代理，将vm上的实例属性代理到vm._renderProxy
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    // 初始化组件实例关系属性、如$parent, $root, $children,$refs等
    initLifecycle(vm)
    // 初始化自定义事件，在<cmp @click="handleClick" />注册的事件，监听者不是父组件，是子组件本身，事件的派发和监听都是子组件本身
    initEvents(vm)
    // 解析插槽信息，得到vm.$slot,处理渲染函数，得到vm.$createElement方法，h函数
    initRender(vm)
    // 调用beforeCreate函数
    callHook(vm, 'beforeCreate', undefined, false /* setContext */)
    // 初始化组件inject配置项，得到result[key] = val形式的配置，然后对结果数据进行响应式处理，代理key到vm实例
    initInjections(vm) // resolve injections before data/props
    // 处理响应式数据，处理props,methods,data,computed,watch等
    initState(vm)
    // 解析组件配置项上的provide，将其挂载到vm._provide属性上
    initProvide(vm) // resolve provide after data/props
    // 调用created函数
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    // 如果options上有el属性，就不需要走$mount方法
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent(
  vm: Component,
  options: InternalComponentOptions
) {
  const opts = (vm.$options = Object.create((vm.constructor as any).options))
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions!
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}
// 从组件构造函数中解析配置对象options，合并到基类选项
export function resolveConstructorOptions(Ctor: typeof Component) {
  let options = Ctor.options
  if (Ctor.super) {
    // 存在基类，递归解析基类构造函数选项
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 基类构造函数变化，重新赋值
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 检查这个是否有任何后期需要修改的或附加的选项
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      // 如果存在，则合并两个选项
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 选项合并，将结果赋值给Ctor.options
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions(
  Ctor: typeof Component
): Record<string, any> | null {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
