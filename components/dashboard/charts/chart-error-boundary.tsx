'use client';

import { Component, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{this.props.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
            <AlertTriangle className="mb-2 h-8 w-8 text-destructive/60" />
            <p className="text-sm">차트를 표시할 수 없습니다.</p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
