import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  showClose?: boolean;
  compact?: boolean;
}

interface BottomSheetState {
  show: boolean;
  animating: boolean;
}

export default class BottomSheet extends Component<PropsWithChildren<BottomSheetProps>, BottomSheetState> {
  constructor(props: BottomSheetProps) {
    super(props);
    this.state = { show: false, animating: false };
  }

  static getDerivedStateFromProps(nextProps: BottomSheetProps): BottomSheetState {
    if (nextProps.visible) {
      return { show: true, animating: true };
    }
    return { show: false, animating: false };
  }

  handleTransitionEnd() {
    if (!this.props.visible) {
      this.setState({ animating: false });
    }
  }

  handleClose() {
    this.setState({ animating: false });
    this.props.onClose();
  }

  render() {
    const { visible, title, showClose = true, compact, children } = this.props;
    const { show, animating } = this.state;

    if (!show) return null;

    return (
      <View
        className={`bottom-sheet-overlay ${visible ? 'bottom-sheet-overlay--visible' : ''}`}
        onClick={() => this.handleClose()}
      >
        <View
          className={`bottom-sheet-panel ${visible ? 'bottom-sheet-panel--visible' : ''} ${compact ? 'bottom-sheet-panel--compact' : ''}`}
          onClick={(e) => e.stopPropagation()}
          onTransitionEnd={() => this.handleTransitionEnd()}
        >
          <View className="bottom-sheet-panel__handle" />
          {title && (
            <View className="bottom-sheet-panel__header">
              <Text className="bottom-sheet-panel__title">{title}</Text>
              {showClose && (
                <View className="bottom-sheet-panel__close" onClick={() => this.handleClose()}>
                  ✕
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
