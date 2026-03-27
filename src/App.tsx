import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  CreditCard, 
  LayoutDashboard, 
  LogOut, 
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  Upload,
  X,
  ChevronRight,
  Menu
} from 'lucide-react';
import { api } from './api';
import { Member, Payment } from './types';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User, db, collection, onSnapshot, query, orderBy, where, getDocs } from './firebase';

// --- Components ---

const CameraModal = ({ onCapture, onClose }: { onCapture: (photo: string) => void, onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' },
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsReady(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Could not access camera. Please check permissions.");
      }
    };
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        onCapture(dataUrl);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl overflow-hidden max-w-md w-full shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="font-bold text-xl">Take Photo</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="relative aspect-square rounded-2xl bg-black overflow-hidden mb-6">
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p>{error}</p>
              </div>
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {!isReady && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <Clock className="w-8 h-8 animate-spin" />
                  </div>
                )}
              </>
            )}
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-bold text-neutral-500 hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={capture}
              disabled={!isReady}
              className="flex-1 py-4 rounded-2xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-600/20"
            >
              Capture
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) => (
  <div className="card p-6 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-sm text-neutral-500 font-medium">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const SectionHeader = ({ title, description, action }: { title: string, description: string, action?: any }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
    <div>
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <p className="text-neutral-500 mt-1">{description}</p>
    </div>
    {action}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      
      // Real-time members
      const qMembers = query(collection(db, 'members'), orderBy('lastName', 'asc'));
      const unsubMembers = onSnapshot(qMembers, (snapshot) => {
        const membersData = snapshot.docs.map(doc => doc.data() as Member);
        setMembers(membersData);
        setIsLoading(false);
      }, (error) => {
        console.error("Members snapshot error:", error);
        setIsLoading(false);
      });

      // Real-time payments
      const qPayments = query(collection(db, 'payments'), orderBy('date', 'desc'));
      const unsubPayments = onSnapshot(qPayments, (snapshot) => {
        const paymentsData = snapshot.docs.map(doc => doc.data() as Payment);
        setPayments(paymentsData);
      }, (error) => {
        console.error("Payments snapshot error:", error);
      });

      return () => {
        unsubMembers();
        unsubPayments();
      };
    }
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      // Map username to a internal email format for Firebase Auth
      const email = `${username.toLowerCase().trim()}@crk-gym.com`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError('Invalid username or password');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 p-6 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-emerald-500/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-500/10 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/5 backdrop-blur-2xl p-8 rounded-3xl relative z-10 border border-white/10 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/20">
              <TrendingUp className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">CRK Gym Elite</h1>
            <p className="text-neutral-400">Admin Management System</p>
          </div>

          <div className="space-y-6">
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Admin Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. admin"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {authError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
              >
                Sign In
              </button>
            </form>

            <p className="text-center text-neutral-500 text-xs">
              Contact the system owner if you've forgotten the universal admin credentials.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 flex-col glass border-r border-neutral-200 fixed h-full z-30">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">CRK Gym Elite</span>
          </div>

          <nav className="space-y-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === item.id 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-neutral-200">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 glass border-b border-neutral-200 p-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-emerald-600 w-6 h-6" />
          <span className="font-bold">CRK Gym Elite</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="lg:hidden fixed inset-0 z-50 bg-white p-8"
          >
            <div className="flex justify-between items-center mb-10">
              <span className="text-xl font-bold">Menu</span>
              <button onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <nav className="space-y-4">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-lg font-medium ${
                    activeTab === item.id ? 'bg-emerald-600 text-white' : 'text-neutral-500'
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  {item.label}
                </button>
              ))}
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-lg font-medium text-red-500"
              >
                <LogOut className="w-6 h-6" />
                Sign Out
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 p-6 lg:p-12 pt-24 lg:pt-12">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SectionHeader 
                title="Dashboard" 
                description="Welcome back, Admin. Here's what's happening today."
                action={
                  <button onClick={() => setActiveTab('members')} className="btn-primary flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    New Member
                  </button>
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <StatCard title="Total Members" value={members.length} icon={Users} color="bg-blue-500" />
                <StatCard title="Active Now" value={members.filter(m => new Date(m.expiration) > new Date() && m.paymentStatus !== 'Pending').length} icon={CheckCircle2} color="bg-emerald-500" />
                <StatCard title="Pending Payments" value={payments.filter(p => p.status === 'Pending').length} icon={Clock} color="bg-amber-500" />
                <StatCard title="Total Revenue" value={`₱${payments.filter(p => p.status === 'Paid').reduce((acc, p) => acc + p.amount, 0).toLocaleString()}`} icon={TrendingUp} color="bg-purple-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="card">
                  <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                    <h3 className="font-bold text-lg">Recent Members</h3>
                    <button onClick={() => setActiveTab('members')} className="text-emerald-600 text-sm font-medium hover:underline">View All</button>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {members.slice(-5).reverse().map(member => (
                      <div key={member.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden">
                            {member.photo ? <img src={member.photo} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-neutral-400" />}
                          </div>
                          <div>
                            <p className="font-medium">{member.firstName} {member.lastName}</p>
                            <p className="text-xs text-neutral-500">{member.type} • {member.id}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-300" />
                      </div>
                    ))}
                    {members.length === 0 && <div className="p-8 text-center text-neutral-400">No members yet</div>}
                  </div>
                </div>

                <div className="card">
                  <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                    <h3 className="font-bold text-lg">Recent Payments</h3>
                    <button onClick={() => setActiveTab('payments')} className="text-emerald-600 text-sm font-medium hover:underline">View All</button>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {payments.slice(-5).reverse().map(payment => (
                      <div key={payment.paymentId} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{payment.memberName}</p>
                            <p className="text-xs text-neutral-500">₱{payment.amount} • {payment.date}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {payment.status}
                        </span>
                      </div>
                    ))}
                    {payments.length === 0 && <div className="p-8 text-center text-neutral-400">No payments yet</div>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div 
              key="members"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <MembersView members={members} />
            </motion.div>
          )}

          {activeTab === 'payments' && (
            <motion.div 
              key="payments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PaymentsView payments={payments} members={members} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Members View ---

const MembersView = ({ members }: { members: Member[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const filteredMembers = members.filter(m => 
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <SectionHeader 
        title="Members" 
        description="Manage your gym community and membership details."
        action={
          <button onClick={() => setIsAdding(true)} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Add Member
          </button>
        }
      />

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5 z-10" />
        <input 
          type="text" 
          placeholder="Search members by name or ID..." 
          className="input-field !pl-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Member</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Membership</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Status</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Expiration</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredMembers.map(member => {
              const isExpired = new Date(member.expiration) <= new Date();
              const isPending = member.paymentStatus === 'Pending';
              const isActive = !isExpired && !isPending;
              
              return (
                <tr key={member.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden">
                        {member.photo ? <img src={member.photo} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-neutral-400" />}
                      </div>
                      <div>
                        <p className="font-bold">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-neutral-500">{member.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{member.type}</p>
                    <p className="text-xs text-neutral-500">{member.duration}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      isActive ? 'bg-emerald-100 text-emerald-700' : 
                      isPending ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {isActive ? 'Active' : isPending ? 'Pending' : 'Expired'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500">
                    {member.expiration}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setEditingMember(member)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredMembers.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
            <p className="text-neutral-500">No members found matching your search.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAdding || editingMember) && (
          <MemberModal 
            member={editingMember} 
            onClose={() => { setIsAdding(false); setEditingMember(null); }} 
            onSuccess={() => { setIsAdding(false); setEditingMember(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const MemberModal = ({ member, onClose, onSuccess }: { member: Member | null, onClose: () => void, onSuccess: () => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showConsentPopup, setShowConsentPopup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Member>>(member || {
    firstName: '',
    lastName: '',
    middleName: '',
    birthday: '',
    age: 0,
    gender: 'Male',
    phone: '',
    email: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    type: 'Student',
    duration: 'Monthly',
    fee: 400,
    regDate: new Date().toISOString().split('T')[0],
    expiration: '',
    photo: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Paid'
  } as any);

  useEffect(() => {
    if (formData.birthday) {
      const birthDate = new Date(formData.birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData(prev => ({ ...prev, age }));
    }
  }, [formData.birthday]);

  useEffect(() => {
    const calculateFee = () => {
      let base = formData.duration === 'Monthly' ? 500 : 5000;
      if (formData.type === 'Student') base *= 0.8;
      else if (formData.type === 'Premium') base *= 0.9;
      else if (formData.type === 'VIP') base *= 0.85;
      return base;
    };

    const calculateExpiration = () => {
      if (!formData.regDate) return '';
      const date = new Date(formData.regDate);
      date.setMonth(date.getMonth() + (formData.duration === 'Monthly' ? 1 : 12));
      return date.toISOString().split('T')[0];
    };

    setFormData(prev => ({ 
      ...prev, 
      fee: calculateFee(),
      expiration: calculateExpiration()
    }));
  }, [formData.type, formData.duration, formData.regDate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for Firestore
        setError("Image is too large. Please select an image under 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, skipConsent = false) => {
    if (e) e.preventDefault();
    setError(null);

    // Phone number validation (exactly 11 digits)
    const phoneDigits = formData.phone?.replace(/\D/g, '') || '';
    if (phoneDigits.length !== 11) {
      setError("Phone number must be exactly 11 digits.");
      return;
    }

    // Age restriction check
    if (!member && (formData.age || 0) < 18 && !skipConsent) {
      setShowConsentPopup(true);
      return;
    }

    try {
      const sanitizedData = { ...formData, phone: phoneDigits };
      if (member) {
        await api.members.update(member.id, sanitizedData as Member);
        
        // Sync payment status if it exists
        const q = query(
          collection(db, 'payments'), 
          where('memberId', '==', member.id)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          // Find the payment that matches the registration date or just the most recent one
          const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Payment }));
          const targetPayment = payments.find(p => p.date === member.regDate) || payments[0];
          
          if (targetPayment) {
            await api.payments.update(targetPayment.paymentId, {
              ...targetPayment,
              memberName: `${formData.firstName} ${formData.lastName}`,
              date: formData.regDate!,
              status: (formData as any).paymentStatus || 'Paid',
              method: (formData as any).paymentMethod || 'Cash'
            });
          }
        }
      } else {
        const id = formData.firstName?.substring(0, 2).toUpperCase() + formData.lastName?.substring(0, 2).toUpperCase() + Math.floor(Math.random() * 10000);
        await api.members.create({ ...sanitizedData, id } as Member);
        // Create initial payment
        await api.payments.create({
          paymentId: 'PAY' + Date.now(),
          memberId: id,
          memberName: `${formData.firstName} ${formData.lastName}`,
          amount: formData.fee!,
          date: formData.regDate!,
          method: (formData as any).paymentMethod || 'Cash',
          status: (formData as any).paymentStatus || 'Paid'
        });
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving member:", error);
      setError("Failed to save member. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (member) {
      try {
        await api.members.delete(member.id);
        onSuccess();
      } catch (error) {
        console.error("Error deleting member:", error);
        setError("Failed to delete member.");
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
      >
        <div className="p-8 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-2xl font-bold">{member ? 'Edit Member' : 'Add New Member'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Photo Section */}
            <div className="flex flex-col items-center gap-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
              <input 
                type="file" 
                ref={cameraInputRef} 
                className="hidden" 
                accept="image/*" 
                capture="user" 
                onChange={handleFileChange} 
              />
              <div className="w-48 h-48 rounded-3xl bg-neutral-100 border-2 border-dashed border-neutral-200 flex items-center justify-center overflow-hidden relative group">
                {formData.photo ? (
                  <img src={formData.photo} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-12 h-12 text-neutral-300" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowCamera(true)}
                    className="p-2 bg-white rounded-lg text-neutral-900 hover:bg-neutral-100 transition-colors"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-white rounded-lg text-neutral-900 hover:bg-neutral-100 transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  {formData.photo && (
                    <button 
                      type="button" 
                      onClick={() => setFormData(prev => ({ ...prev, photo: '' }))}
                      className="p-2 bg-white rounded-lg text-red-500 hover:bg-neutral-100 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral-400 text-center">Recommended: 400x400px JPG or PNG</p>
            </div>

            {showCamera && (
              <CameraModal 
                onCapture={(photo) => setFormData(prev => ({ ...prev, photo }))} 
                onClose={() => setShowCamera(false)} 
              />
            )}

            {/* Form Fields */}
            <div className="md:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">First Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formData.firstName} 
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Middle Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formData.middleName} 
                    onChange={e => setFormData({...formData, middleName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Last Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formData.lastName} 
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Birthday</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={formData.birthday} 
                    onChange={e => setFormData({...formData, birthday: e.target.value})}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Age</label>
                  <input type="number" className="input-field bg-neutral-50" value={formData.age} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Gender</label>
                  <select 
                    className="input-field" 
                    value={formData.gender} 
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                  <input 
                    type="tel" 
                    className="input-field" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    className="input-field" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-neutral-100">
            <div className="space-y-4">
              <h4 className="font-bold text-lg">Registration Details</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Registration Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={formData.regDate} 
                    onChange={e => setFormData({...formData, regDate: e.target.value})}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Initial Payment Method</label>
                  <select 
                    className="input-field" 
                    value={(formData as any).paymentMethod} 
                    onChange={e => {
                      const method = e.target.value;
                      setFormData({
                        ...formData, 
                        paymentMethod: method,
                        paymentStatus: method === 'Cash' ? 'Paid' : ((formData as any).paymentStatus || 'Paid')
                      } as any);
                    }}
                  >
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>G-Cash</option>
                  </select>
                </div>
                {((formData as any).paymentMethod === 'Bank Transfer' || (formData as any).paymentMethod === 'G-Cash') && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Status</label>
                    <select 
                      className="input-field" 
                      value={(formData as any).paymentStatus} 
                      onChange={e => setFormData({...formData, paymentStatus: e.target.value} as any)}
                    >
                      <option>Paid</option>
                      <option>Pending</option>
                    </select>
                  </div>
                )}
              </div>

              <h4 className="font-bold text-lg mt-6">Emergency Contact</h4>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Contact Name" 
                  className="input-field" 
                  value={formData.emergencyName} 
                  onChange={e => setFormData({...formData, emergencyName: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="Relation" 
                    className="input-field" 
                    value={formData.emergencyRelation} 
                    onChange={e => setFormData({...formData, emergencyRelation: e.target.value})}
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone" 
                    className="input-field" 
                    value={formData.emergencyPhone} 
                    onChange={e => setFormData({...formData, emergencyPhone: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-lg">Membership Plan</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
                  <select 
                    className="input-field" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option>Student</option>
                    <option>Premium</option>
                    <option>VIP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Duration</label>
                  <select 
                    className="input-field" 
                    value={formData.duration} 
                    onChange={e => setFormData({...formData, duration: e.target.value})}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Total Fee</p>
                  <p className="text-2xl font-bold text-emerald-900">₱{formData.fee?.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-emerald-600 font-medium">Expires on</p>
                  <p className="font-bold text-emerald-900">{formData.expiration}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-neutral-100">
            {member ? (
              <button type="button" onClick={() => setShowDeleteConfirm(true)} className="text-red-500 font-bold hover:underline">Delete Member</button>
            ) : <div />}
            <div className="flex gap-4">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">{member ? 'Save Changes' : 'Register Member'}</button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Popup */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl"
              >
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold mb-2">Delete Member?</h4>
                <p className="text-neutral-500 mb-8">
                  Are you sure you want to delete this member? This action cannot be undone.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleDelete}
                    className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
                  >
                    Yes, Delete
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Consent Popup */}
        <AnimatePresence>
          {showConsentPopup && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl"
              >
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold mb-2">Parental Consent Required</h4>
                <p className="text-neutral-500 mb-8">
                  This member is under 18 years old. Do they have parent or guardian consent to join the gym?
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setShowConsentPopup(false);
                      handleSubmit(undefined, true);
                    }}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => setShowConsentPopup(false)}
                    className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Reject
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// --- Payments View ---

const PaymentsView = ({ payments, members }: { payments: Payment[], members: Member[] }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPayments = payments.filter(p => 
    p.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.paymentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <SectionHeader 
        title="Payments" 
        description="Track revenue, manage subscriptions, and handle billing."
      />

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5 z-10" />
        <input 
          type="text" 
          placeholder="Search payments by member name or ID..." 
          className="input-field !pl-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Transaction</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Member</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Amount</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Date</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Method</th>
              <th className="px-6 py-4 text-sm font-bold text-neutral-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredPayments.map(payment => (
              <tr key={payment.paymentId} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-bold">{payment.paymentId}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium">{payment.memberName}</p>
                  <p className="text-xs text-neutral-500">{payment.memberId}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-neutral-900">₱{payment.amount.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4 text-sm text-neutral-500">
                  {payment.date}
                </td>
                <td className="px-6 py-4 text-sm text-neutral-500">
                  {payment.method}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                    payment.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {payment.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPayments.length === 0 && (
          <div className="p-12 text-center">
            <CreditCard className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
            <p className="text-neutral-500">No payment records found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

