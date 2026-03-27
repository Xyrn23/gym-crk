export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  birthday: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  type: string;
  duration: string;
  fee: number;
  regDate: string;
  expiration: string;
  photo?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}

export interface Payment {
  paymentId: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string;
  method: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Expired';
}
