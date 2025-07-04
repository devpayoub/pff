'use client';
import React, { useEffect, useState } from 'react';
import { Users, Search, Filter, Download, Eye, Mail, Calendar, UserCheck, Trash2, Ban, AlertTriangle } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import moment from 'moment';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showBanned, setShowBanned] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchTerm, sortBy, sortOrder, showBanned]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get interview counts for each user
      const usersWithStats = await Promise.all(
        data.map(async (user) => {
          const { count: interviewCount } = await supabase
            .from('Interviews')
            .select('*', { count: 'exact', head: true })
            .eq('userEmail', user.email);

          const { count: candidateCount } = await supabase
            .from('interview_results')
            .select('*', { count: 'exact', head: true })
            .eq('interview_id', user.interview_id);

          return {
            ...user,
            interviewCount: interviewCount || 0,
            candidateCount: candidateCount || 0
          };
        })
      );

      setUsers(usersWithStats);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortUsers = () => {
    let filtered = users.filter(user => {
      // Filter by search term
      const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by banned status
      const matchesBannedFilter = showBanned || !user.banned;
      
      return matchesSearch && matchesBannedFilter;
    });

    // Sort users
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'created_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredUsers(filtered);
  };

  const exportUsersToCSV = () => {
    const csvContent = [
      ['Name', 'Email', 'Created Date', 'Interviews Created', 'Candidates Interviewed', 'Credits', 'Status'],
      ...filteredUsers.map(user => [
        user.name || 'N/A',
        user.email || 'N/A',
        moment(user.created_at).format('YYYY-MM-DD HH:mm'),
        user.interviewCount,
        user.candidateCount,
        user.credits || 0,
        getStatusText(user)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${moment().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Users exported successfully');
  };

  const getStatusText = (user) => {
    if (user.banned) return 'Banned';
    if (user.interviewCount > 0) return 'Active';
    if (user.created_at) return 'Registered';
    return 'Inactive';
  };

  const getStatusColor = (user) => {
    if (user.banned) return 'text-red-600 bg-red-50';
    if (user.interviewCount > 0) return 'text-green-600 bg-green-50';
    if (user.created_at) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  const deleteUser = async (userId) => {
    try {
      // First, delete all related data
      const { error: interviewsError } = await supabase
        .from('Interviews')
        .delete()
        .eq('userEmail', users.find(u => u.id === userId)?.email);

      if (interviewsError) {
        console.error('Error deleting interviews:', interviewsError);
      }

      const { error: resultsError } = await supabase
        .from('interview_results')
        .delete()
        .eq('interview_id', users.find(u => u.id === userId)?.interview_id);

      if (resultsError) {
        console.error('Error deleting interview results:', resultsError);
      }

      // Finally, delete the user
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast.success('User deleted successfully');
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const banUser = async (userId, banStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ banned: banStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success(banStatus ? 'User banned successfully' : 'User unbanned successfully');
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating user ban status:', error);
      toast.error('Failed to update user status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage and monitor all registered users</p>
        </div>
        <Button onClick={exportUsersToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export Users
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.interviewCount > 0 && !u.banned).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Created interviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banned Users</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => u.banned).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Suspended accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.reduce((sum, user) => sum + user.interviewCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Created across all users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.reduce((sum, user) => sum + user.candidateCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Interviewed candidates
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter Users</CardTitle>
          <CardDescription>
            Find specific users or filter by various criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="created_at">Created Date</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="interviewCount">Interviews</option>
              </select>
              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <Filter className="w-4 h-4" />
              </Button>
              <Button
                variant={showBanned ? "default" : "outline"}
                onClick={() => setShowBanned(!showBanned)}
                className={showBanned ? "bg-red-600 hover:bg-red-700" : ""}
              >
                <Ban className="w-4 h-4 mr-1" />
                {showBanned ? 'Hide Banned' : 'Show Banned'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Complete list of registered users and their activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
                         <div className="space-y-4">
               {filteredUsers.map((user) => (
                 <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                   <div className="flex items-center space-x-4">
                     <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                       <span className="text-sm font-medium text-blue-600">
                         {user.name?.charAt(0)?.toUpperCase() || 'U'}
                       </span>
                     </div>
                     <div>
                       <h3 className="font-medium text-gray-900">
                         {user.name || 'Unnamed User'}
                       </h3>
                       <div className="flex items-center space-x-4 text-sm text-gray-500">
                         <span className="flex items-center">
                           <Mail className="w-3 h-3 mr-1" />
                           {user.email}
                         </span>
                         <span className="flex items-center">
                           <Calendar className="w-3 h-3 mr-1" />
                           {moment(user.created_at).format('MMM DD, YYYY')}
                         </span>
                       </div>
                     </div>
                   </div>
                   
                   <div className="flex items-center space-x-6">
                     <div className="text-right">
                       <div className="text-sm font-medium text-gray-900">
                         {user.interviewCount} interviews
                       </div>
                       <div className="text-xs text-gray-500">
                         {user.candidateCount} candidates
                       </div>
                     </div>
                     
                     <div className="text-right">
                       <div className="text-sm font-medium text-gray-900">
                         {user.credits || 0} credits
                       </div>
                       <div className={`text-xs px-2 py-1 rounded-full ${getStatusColor(user)}`}>
                         {getStatusText(user)}
                       </div>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex items-center space-x-2">
                       {/* Ban/Unban Button */}
                       <AlertDialog>
                         <AlertDialogTrigger asChild>
                           <Button
                             variant="outline"
                             size="sm"
                             className={user.banned ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700"}
                           >
                             {user.banned ? (
                               <>
                                 <UserCheck className="w-3 h-3 mr-1" />
                                 Unban
                               </>
                             ) : (
                               <>
                                 <Ban className="w-3 h-3 mr-1" />
                                 Ban
                               </>
                             )}
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent>
                           <AlertDialogHeader>
                             <AlertDialogTitle>
                               {user.banned ? 'Unban User' : 'Ban User'}
                             </AlertDialogTitle>
                             <AlertDialogDescription>
                               {user.banned 
                                 ? `Are you sure you want to unban ${user.name || user.email}? They will be able to access the platform again.`
                                 : `Are you sure you want to ban ${user.name || user.email}? They will lose access to the platform.`
                               }
                             </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel>Cancel</AlertDialogCancel>
                             <AlertDialogAction
                               onClick={() => banUser(user.id, !user.banned)}
                               className={user.banned ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                             >
                               {user.banned ? 'Unban User' : 'Ban User'}
                             </AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>

                       {/* Delete Button */}
                       <AlertDialog>
                         <AlertDialogTrigger asChild>
                           <Button
                             variant="outline"
                             size="sm"
                             className="text-red-600 hover:text-red-700 hover:bg-red-50"
                           >
                             <Trash2 className="w-3 h-3 mr-1" />
                             Delete
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent>
                           <AlertDialogHeader>
                             <AlertDialogTitle className="flex items-center gap-2">
                               <AlertTriangle className="w-5 h-5 text-red-600" />
                               Delete User
                             </AlertDialogTitle>
                             <AlertDialogDescription>
                               This action cannot be undone. This will permanently delete{' '}
                               <strong>{user.name || user.email}</strong> and all their data including:
                               <ul className="list-disc list-inside mt-2 space-y-1">
                                 <li>All created interviews</li>
                                 <li>All interview results</li>
                                 <li>User account and settings</li>
                               </ul>
                             </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel>Cancel</AlertDialogCancel>
                             <AlertDialogAction
                               onClick={() => deleteUser(user.id)}
                               className="bg-red-600 hover:bg-red-700"
                             >
                               Delete User
                             </AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                     </div>
                   </div>
                 </div>
               ))}
              
              {filteredUsers.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No users found matching your criteria</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UserManagement; 