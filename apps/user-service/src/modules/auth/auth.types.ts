export interface SafeUser{
  id: string;
  email: string;
  firstName: string;
    lastName: string;
    createdAt: Date;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}
