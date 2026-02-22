// 최근 주문 목록 테이블
// Server Component로 동작 (인터랙션 없음)
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
// TODO(Phase 5): 이 파일은 레거시 스타터킷 컴포넌트로 Phase 5에서 삭제 예정
// RecentOrder 타입은 Phase 1 타입 교체로 삭제됨 — 인라인 정의로 대체
interface RecentOrder {
  id: string;
  customerName: string;
  product: string;
  amount: number;
  status: '완료' | '처리중' | '취소';
  date: string;
}

interface RecentOrdersTableProps {
  data: RecentOrder[];
}

// 주문 상태별 배지 스타일
const statusStyles: Record<RecentOrder["status"], string> = {
  완료: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  처리중:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  취소: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function RecentOrdersTable({ data }: RecentOrdersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>최근 주문</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>주문번호</TableHead>
              <TableHead>고객명</TableHead>
              <TableHead className="hidden sm:table-cell">상품</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="hidden md:table-cell">날짜</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.id}</TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {order.product}
                </TableCell>
                <TableCell className="text-right">
                  ₩{order.amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                      statusStyles[order.status]
                    )}
                  >
                    {order.status}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {order.date}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
