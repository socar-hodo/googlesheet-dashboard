'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function RelocationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="space-y-4 pt-6">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">재배치 페이지를 불러올 수 없습니다</h2>
          <p className="text-sm text-muted-foreground">
            잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60">오류 코드: {error.digest}</p>
          )}
          <Button onClick={reset}>다시 시도</Button>
        </CardContent>
      </Card>
    </div>
  );
}
