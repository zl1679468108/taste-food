import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import Icon from '../Icon';
import './index.scss';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  showClose?: boolean;
  compact?: boolean;
  /** 内容区去掉默认 padding，由内部自行控制边距 */
  flush?: boolean;
}

interface BottomSheetState {
  /** 是否挂载在 DOM 中（控制退出动画完成后再卸载） */
  mounted: boolean;
}

export default class BottomSheet extends Component<PropsWithChildren<BottomSheetProps>, BottomSheetState> {
  constructor(props: BottomSheetProps) {
    super(props);
    this.state = { mounted: props.visible };
  }

  static getDerivedStateFromProps(nextProps: BottomSheetProps, prevState: BottomSheetState): BottomSheetState {
    // 打开时立即挂载；关闭时保持挂载，由 transitionEnd 后再卸载
    if (nextProps.visible) {
      return { mounted: true };
    }
    return prevState;
  }

  handleTransitionEnd() {
    // 退出动画结束后才真正卸载
    if (!this.props.visible) {
      this.setState({ mounted: false });
    }
  }

  handleClose() {
    this.props.onClose();
  }

  render() {
    const { visible, title, showClose = true, compact, flush, children } = this.props;
    const { mounted } = this.state;

    if (!mounted) return null;

    return (
      <View
        className={`bottom-sheet-overlay ${visible ? 'bottom-sheet-overlay--visible' : ''}`}
        onClick={() => this.handleClose()}
      >
        <View
          className={`bottom-sheet-panel ${visible ? 'bottom-sheet-panel--visible' : ''} ${compact ? 'bottom-sheet-panel--compact' : ''} ${flush ? 'bottom-sheet-panel--flush' : ''}`}
          onClick={(e) => e.stopPropagation()}
          onTransitionEnd={() => this.handleTransitionEnd()}
        >
          <View className="bottom-sheet-panel__handle" />
          {title && (
            <View className="bottom-sheet-panel__header">
              <Text className="bottom-sheet-panel__title">{title}</Text>
              {showClose && (
                <View className="bottom-sheet-panel__close" onClick={() => this.handleClose()}>
                  <Icon name="close" size={16} color="#999999" />
                </View>
              )}
            </View>
          )}
          <View className="bottom-sheet-panel__body">
            {children}
          </View>
        </View>
      </View>
    );
  }
}
