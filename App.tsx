import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Transaction, Goal } from './types';
import IncomeForm from './components/IncomeForm';
import TransactionList from './components/TransactionList';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import { GoalTracker } from './components/GoalTracker';
import Login from './components/Login';
import ProfileModal from './components/ProfileModal';
import { userService, transactionService, goalService } from './supabase/services';

interface User {
    name: string;
    username: string;
}

const initialTransactions: Transaction[] = [
    { id: '1', description: 'Salário', amount: 5000, date: new Date() },
    { id: '2', description: 'Freelance', amount: 750, date: new Date(new Date().setDate(new Date().getDate() - 3)) },
    { id: '3', description: 'Venda online', amount: 120, date: new Date(new Date().setDate(new Date().getDate() - 10)) },
    { id: '4', description: 'Consultoria', amount: 1200, date: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
];

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('currentUser');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
    const [goal, setGoal] = useState<Goal | null>(() => {
        const savedGoal = localStorage.getItem('financialGoal');
        if (savedGoal) {
            try {
                const parsedGoal = JSON.parse(savedGoal);
                if (parsedGoal.amount && parsedGoal.deadline) {
                    return parsedGoal;
                }
            } catch (e) {
                return null;
            }
        }
        return null;
    });

    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('app-auth', 'true');
        } else {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('app-auth');
        }
    }, [currentUser]);

    useEffect(() => {
        if (goal) {
            localStorage.setItem('financialGoal', JSON.stringify(goal));
        } else {
            localStorage.removeItem('financialGoal');
        }
    }, [goal]);

    const handleAuthSuccess = async (user: User) => {
        setCurrentUser(user);
        let supabaseUser = await userService.getUserByUsername(user.username);

        if (!supabaseUser) {
            supabaseUser = await userService.createUser(user.name, user.username);
        }

        if (supabaseUser) {
            setUserId(supabaseUser.id);

            const supabaseTransactions = await transactionService.getTransactions(supabaseUser.id);
            if (supabaseTransactions.length > 0) {
                setTransactions(supabaseTransactions);
            }

            const supabaseGoal = await goalService.getGoal(supabaseUser.id);
            if (supabaseGoal) {
                setGoal(supabaseGoal);
            }
        }
    };

    const handleAddTransaction = useCallback(async (description: string, amount: number) => {
        const newTransaction: Transaction = {
            id: crypto.randomUUID(),
            description,
            amount,
            date: new Date(),
        };

        if (userId) {
            const savedTransaction = await transactionService.addTransaction(userId, {
                description,
                amount,
                date: new Date(),
            });

            if (savedTransaction) {
                setTransactions((prev: Transaction[]) => [...prev, savedTransaction]);
                return;
            }
        }

        setTransactions((prev: Transaction[]) => [...prev, newTransaction]);
    }, [userId]);

    const handleDeleteTransaction = useCallback(async (id: string) => {
        if (userId) {
            const deleted = await transactionService.deleteTransaction(id);
            if (deleted) {
                setTransactions((prev: Transaction[]) => prev.filter((t: Transaction) => t.id !== id));
                return;
            }
        }

        setTransactions((prev: Transaction[]) => prev.filter((t: Transaction) => t.id !== id));
    }, [userId]);

    const handleSetGoal = useCallback(async (newGoal: Goal) => {
        if (userId) {
            const savedGoal = await goalService.setGoal(userId, newGoal);
            if (savedGoal) {
                setGoal(savedGoal);
                return;
            }
        }

        setGoal(newGoal);
    }, [userId]);

    const handleUpdateUser = async (updatedData: { name: string; username: string }) => {
        if (currentUser) {
            const newUser = { ...currentUser, ...updatedData };
            setCurrentUser(newUser);

            if (userId) {
                await userService.updateUser(userId, updatedData);
            }

            setIsProfileModalOpen(false);
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
    };

    const totalIncome = useMemo(() => {
        return transactions.reduce((sum, t) => sum + t.amount, 0);
    }, [transactions]);

    if (!currentUser) {
        return <Login onAuthSuccess={handleAuthSuccess} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
            <main className="container mx-auto p-4 md:p-8">
                <Header
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onOpenProfile={() => setIsProfileModalOpen(true)}
                />
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 lg:gap-8">
                    <div className="lg:col-span-1 space-y-8">
                        <IncomeForm onAddTransaction={handleAddTransaction} />
                        <GoalTracker goal={goal} onSetGoal={handleSetGoal} totalIncome={totalIncome} />
                        <TransactionList transactions={transactions} onDeleteTransaction={handleDeleteTransaction} />
                    </div>
                    <div className="lg:col-span-2 mt-8 lg:mt-0">
                        <Dashboard transactions={transactions} />
                    </div>
                </div>
            </main>
            {isProfileModalOpen && (
                <ProfileModal
                    user={currentUser}
                    onClose={() => setIsProfileModalOpen(false)}
                    onSave={handleUpdateUser}
                />
            )}
        </div>
    );
};

export default App;
