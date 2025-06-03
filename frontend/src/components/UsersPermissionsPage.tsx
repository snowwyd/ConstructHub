import {
	Add as AddIcon,
	AdminPanelSettings,
	Close as CloseIcon,
	Delete as DeleteIcon,
	Edit as EditIcon,
	FolderOutlined,
	ManageAccountsOutlined,
	PersonAddOutlined,
	PersonOutline,
	Refresh as RefreshIcon,
	SecurityOutlined,
} from '@mui/icons-material';
import {
	Alert,
	alpha,
	Box,
	Button,
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	FormControl,
	Grid2 as Grid,
	IconButton,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	Snackbar,
	Tab,
	Tabs,
	TextField,
	Tooltip,
	Typography,
	useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { axiosFetching } from '../api/AxiosFetch';
import config from '../constants/Configurations.json';
import ErrorState from './ErrorState';
import FileAccessManager from './FileAccessManager'; // ВАЖНО: Возвращаем импорт!
import LoadingState from './LoadingState';

// Интерфейсы для типизации данных
interface User {
	user_id: number;
	login: string;
	role_id?: number;
	role_name?: string;
	created_at?: string;
	updated_at?: string;
}

interface Role {
	role_id: number;
	role_name: string;
	description?: string;
	permissions?: string[];
	created_at?: string;
	updated_at?: string;
}

interface UsersByRole {
	role_name: string;
	users: User[];
}

const availablePermissions = [
	{ id: 'view_files', name: 'Просмотр файлов' },
	{ id: 'edit_files', name: 'Редактирование файлов' },
	{ id: 'upload_files', name: 'Загрузка файлов' },
	{ id: 'delete_files', name: 'Удаление файлов' },
	{ id: 'approve_files', name: 'Согласование файлов' },
	{ id: 'manage_users', name: 'Управление пользователями' },
	{ id: 'manage_roles', name: 'Управление ролями' },
	{ id: 'manage_workflows', name: 'Управление процессами согласования' },
	{ id: 'view_admin', name: 'Доступ к панели администратора' },
];

const UsersPermissionsPage = () => {
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState(0);
	const [snackbar, setSnackbar] = useState({
		open: false,
		message: '',
		severity: 'success' as 'success' | 'error',
	});

	// Состояние для пользовательских форм
	const [userDialogOpen, setUserDialogOpen] = useState(false);
	const [userFormData, setUserFormData] = useState({
		id: 0,
		login: '',
		password: '',
		roleId: 0,
	});
	const [isEditingUser, setIsEditingUser] = useState(false);
	const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
	const [userToDelete, setUserToDelete] = useState<User | null>(null);

	// Состояние для форм ролей
	const [roleDialogOpen, setRoleDialogOpen] = useState(false);
	const [roleFormData, setRoleFormData] = useState({
		id: 0,
		name: '',
		description: '',
		permissions: [] as string[],
	});
	const [isEditingRole, setIsEditingRole] = useState(false);
	const [deleteRoleDialogOpen, setDeleteRoleDialogOpen] = useState(false);
	const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

	// Запросы к API для получения пользователей
	const {
		data: usersData,
		isLoading: isUsersLoading,
		isError: isUsersError,
		refetch: refetchUsers,
	} = useQuery({
		queryKey: ['admin', 'users'],
		queryFn: async () => {
			const response = await axiosFetching.get(config.getUsers || '/admin/users');
			return response.data;
		},
	});

	// Запросы к API для получения ролей
	const {
		data: roles,
		isLoading: isRolesLoading,
		isError: isRolesError,
		refetch: refetchRoles,
	} = useQuery({
		queryKey: ['admin', 'roles'],
		queryFn: async () => {
			const response = await axiosFetching.get(config.getRoles || '/admin/roles');
			return response.data;
		},
	});

	// Преобразуем данные пользователей из формата "по ролям" в плоский массив
	const users = React.useMemo(() => {
		if (!usersData || !Array.isArray(usersData)) return [];
		
		const flatUsers: User[] = [];
		usersData.forEach((roleGroup: UsersByRole) => {
			roleGroup.users.forEach((user) => {
				flatUsers.push({
					...user,
					role_name: roleGroup.role_name,
					// Находим role_id по role_name
					role_id: roles?.find((r: Role) => r.role_name === roleGroup.role_name)?.role_id,
				});
			});
		});
		return flatUsers;
	}, [usersData, roles]);

	// Мутации для пользователей
	const createUserMutation = useMutation({
		mutationFn: async (userData: {
			login: string;
			password: string;
			role_id: number;
		}) => {
			const response = await axiosFetching.post(
				config.createUser || '/admin/users/register',
				userData
			);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Пользователь успешно создан',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
			setUserDialogOpen(false);
			resetUserForm();
		},
		onError: (error: any) => {
			console.error('Error creating user:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при создании пользователя: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const updateUserMutation = useMutation({
		mutationFn: async ({
			userId,
			userData,
		}: {
			userId: number;
			userData: { login?: string; password?: string; role_id?: number };
		}) => {
			const url = (config.updateUser || '/admin/users/:user_id').replace(':user_id', userId.toString());
			const response = await axiosFetching.put(url, userData);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Пользователь успешно обновлен',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
			setUserDialogOpen(false);
			resetUserForm();
		},
		onError: (error: any) => {
			console.error('Error updating user:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при обновлении пользователя: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const deleteUserMutation = useMutation({
		mutationFn: async (userId: number) => {
			const response = await axiosFetching.delete(config.deleteUser || '/admin/users', {
				data: { user_id: userId }, // Используем user_id вместо id
			});
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Пользователь успешно удален',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
			setDeleteUserDialogOpen(false);
			setUserToDelete(null);
		},
		onError: (error: any) => {
			console.error('Error deleting user:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при удалении пользователя: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	// Мутации для ролей
	const createRoleMutation = useMutation({
		mutationFn: async (roleData: {
			role_name: string;
			description?: string;
			permissions?: string[];
		}) => {
			const response = await axiosFetching.post(config.createRole || '/admin/roles', roleData);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Роль успешно создана',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
			setRoleDialogOpen(false);
			resetRoleForm();
		},
		onError: (error: any) => {
			console.error('Error creating role:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при создании роли: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const updateRoleMutation = useMutation({
		mutationFn: async ({
			roleId,
			roleData,
		}: {
			roleId: number;
			roleData: { role_name?: string; description?: string; permissions?: string[] };
		}) => {
			const url = (config.updateRole || '/admin/roles/:role_id').replace(':role_id', roleId.toString());
			const response = await axiosFetching.put(url, roleData);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Роль успешно обновлена',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
			setRoleDialogOpen(false);
			resetRoleForm();
		},
		onError: (error: any) => {
			console.error('Error updating role:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при обновлении роли: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const deleteRoleMutation = useMutation({
		mutationFn: async (roleId: number) => {
			const response = await axiosFetching.delete(config.deleteRole || '/admin/roles', {
				data: { role_id: roleId }, // Используем role_id вместо id
			});
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Роль успешно удалена',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
			setDeleteRoleDialogOpen(false);
			setRoleToDelete(null);
		},
		onError: (error: any) => {
			console.error('Error deleting role:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при удалении роли: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	// Вспомогательные функции
	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setActiveTab(newValue);
	};

	const resetUserForm = () => {
		setUserFormData({ id: 0, login: '', password: '', roleId: 0 });
		setIsEditingUser(false);
	};

	const resetRoleForm = () => {
		setRoleFormData({ id: 0, name: '', description: '', permissions: [] });
		setIsEditingRole(false);
	};

	const handleCreateUser = () => {
		setIsEditingUser(false);
		resetUserForm();
		setUserDialogOpen(true);
	};

	const handleEditUser = (user: User) => {
		setIsEditingUser(true);
		setUserFormData({
			id: user.user_id,
			login: user.login,
			password: '', // Не заполняем пароль при редактировании
			roleId: user.role_id || 0,
		});
		setUserDialogOpen(true);
	};

	const handleDeleteUser = (user: User) => {
		setUserToDelete(user);
		setDeleteUserDialogOpen(true);
	};

	const handleCreateRole = () => {
		setIsEditingRole(false);
		resetRoleForm();
		setRoleDialogOpen(true);
	};

	const handleEditRole = (role: Role) => {
		setIsEditingRole(true);
		setRoleFormData({
			id: role.role_id,
			name: role.role_name,
			description: role.description || '',
			permissions: role.permissions || [],
		});
		setRoleDialogOpen(true);
	};

	const handleDeleteRole = (role: Role) => {
		setRoleToDelete(role);
		setDeleteRoleDialogOpen(true);
	};

	const submitUserForm = () => {
		if (isEditingUser) {
			const userData: { login?: string; password?: string; role_id?: number } =
				{
					login: userFormData.login,
					role_id: userFormData.roleId,
				};

			// Добавляем пароль только если он был изменен
			if (userFormData.password) {
				userData.password = userFormData.password;
			}

			updateUserMutation.mutate({ userId: userFormData.id, userData });
		} else {
			createUserMutation.mutate({
				login: userFormData.login,
				password: userFormData.password,
				role_id: userFormData.roleId,
			});
		}
	};

	const submitRoleForm = () => {
		if (isEditingRole) {
			updateRoleMutation.mutate({
				roleId: roleFormData.id,
				roleData: {
					role_name: roleFormData.name,
					description: roleFormData.description,
					permissions: roleFormData.permissions,
				},
			});
		} else {
			createRoleMutation.mutate({
				role_name: roleFormData.name,
				description: roleFormData.description,
				permissions: roleFormData.permissions,
			});
		}
	};

	const confirmDeleteUser = () => {
		if (userToDelete) {
			deleteUserMutation.mutate(userToDelete.user_id);
		}
	};

	const confirmDeleteRole = () => {
		if (roleToDelete) {
			deleteRoleMutation.mutate(roleToDelete.role_id);
		}
	};

	const handlePermissionToggle = (permission: string) => {
		const currentPermissions = roleFormData.permissions || [];

		if (currentPermissions.includes(permission)) {
			setRoleFormData({
				...roleFormData,
				permissions: currentPermissions.filter(p => p !== permission),
			});
		} else {
			setRoleFormData({
				...roleFormData,
				permissions: [...currentPermissions, permission],
			});
		}
	};

	// Проверка на загрузку и ошибки
	if (
		(activeTab === 0 && isUsersLoading) ||
		(activeTab === 1 && isRolesLoading)
	) {
		const loadingMessage =
			activeTab === 0
				? 'Загрузка пользователей...'
				: 'Загрузка ролей...';
		return <LoadingState message={loadingMessage} />;
	}

	if (
		(activeTab === 0 && isUsersError) ||
		(activeTab === 1 && isRolesError)
	) {
		const retryFunction =
			activeTab === 0
				? refetchUsers
				: refetchRoles;
		return <ErrorState onRetry={retryFunction} />;
	}

	// Основной рендер компонента
	return (
		<Box sx={{ p: 4 }}>
			<Paper
				elevation={2}
				sx={{
					borderRadius: 3,
					overflow: 'hidden',
					maxWidth: 1200,
					mx: 'auto',
					bgcolor: theme.palette.background.paper,
					boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.12)}`,
				}}
			>
				{/* Заголовок */}
				<Box
					sx={{
						bgcolor: alpha(theme.palette.secondary.light, 0.1),
						py: 2.5,
						px: 4,
						borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
					}}
				>
					<Typography variant='h5' fontWeight={600} gutterBottom>
						Управление правами и пользователями
					</Typography>
					<Typography variant='body1' color='text.secondary'>
						Настройка пользователей, ролей и прав доступа в системе
					</Typography>
				</Box>

				{/* Табы */}
				<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
					<Tabs
						value={activeTab}
						onChange={handleTabChange}
						aria-label='admin tabs'
						sx={{
							'& .MuiTab-root': {
								textTransform: 'none',
								fontSize: '0.95rem',
								fontWeight: 500,
								py: 2,
								px: 3,
							},
						}}
					>
						<Tab
							label='Управление пользователями'
							icon={<PersonOutline />}
							iconPosition='start'
						/>
						<Tab
							label='Управление ролями'
							icon={<SecurityOutlined />}
							iconPosition='start'
						/>
						<Tab
							label='Доступ к файлам'
							icon={<FolderOutlined />}
							iconPosition='start'
						/>
					</Tabs>
				</Box>

				{/* Содержимое табов */}
				<Box sx={{ p: 4 }}>
					{/* Таб управления пользователями */}
					{activeTab === 0 && (
						<Box>
							<Box
								sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}
							>
								<Typography variant='h6' gutterBottom>
									Список пользователей
								</Typography>
								<Box sx={{ display: 'flex', gap: 1 }}>
									<Button
										variant='outlined'
										startIcon={<RefreshIcon />}
										onClick={() => refetchUsers()}
										sx={{ borderRadius: 2 }}
									>
										Обновить
									</Button>
									<Button
										variant='contained'
										startIcon={<PersonAddOutlined />}
										onClick={handleCreateUser}
										sx={{ borderRadius: 2 }}
									>
										Добавить пользователя
									</Button>
								</Box>
							</Box>

							<Divider sx={{ my: 2 }} />

							{users && Array.isArray(users) && users.length > 0 ? (
								<Grid container spacing={2}>
									{users.map((user: User) => (
										<Grid size={{ xs: 12, md: 6, lg: 4 }} key={user.user_id}>
											<Paper
												elevation={1}
												sx={{
													p: 2,
													borderRadius: 2,
													border: `1px solid ${alpha(
														theme.palette.divider,
														0.1
													)}`,
													transition: 'all 0.2s',
													'&:hover': {
														boxShadow: `0 4px 12px ${alpha(
															theme.palette.primary.main,
															0.1
														)}`,
													},
												}}
											>
												<Box
													sx={{
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
														mb: 1,
													}}
												>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 1,
														}}
													>
														<PersonOutline color='primary' />
														<Typography variant='subtitle1' fontWeight={600}>
															{user.login}
														</Typography>
													</Box>
													<Box>
														<Tooltip title='Редактировать'>
															<IconButton
																size='small'
																color='primary'
																onClick={() => handleEditUser(user)}
															>
																<EditIcon fontSize='small' />
															</IconButton>
														</Tooltip>
														<Tooltip title='Удалить'>
															<IconButton
																size='small'
																color='error'
																onClick={() => handleDeleteUser(user)}
															>
																<DeleteIcon fontSize='small' />
															</IconButton>
														</Tooltip>
													</Box>
												</Box>
												<Box sx={{ mt: 1 }}>
													<Chip
														icon={<AdminPanelSettings fontSize='small' />}
														label={user.role_name || 'Без роли'}
														size='small'
														color={
															user.role_name === 'admin' ? 'primary' : 'default'
														}
														variant='outlined'
													/>
												</Box>
												<Typography
													variant='caption'
													color='text.secondary'
													sx={{ display: 'block', mt: 1 }}
												>
													ID: {user.user_id}
													{user.created_at && ` • Создан: ${new Date(user.created_at).toLocaleDateString()}`}
												</Typography>
											</Paper>
										</Grid>
									))}
								</Grid>
							) : (
								<Box sx={{ textAlign: 'center', py: 4 }}>
									<PersonOutline
										sx={{
											fontSize: 60,
											color: alpha(theme.palette.text.secondary, 0.2),
											mb: 2,
										}}
									/>
									<Typography color='text.secondary'>
										Список пользователей пуст
									</Typography>
								</Box>
							)}
						</Box>
					)}

					{/* Таб управления ролями */}
					{activeTab === 1 && (
						<Box>
							<Box
								sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}
							>
								<Typography variant='h6' gutterBottom>
									Список ролей
								</Typography>
								<Box sx={{ display: 'flex', gap: 1 }}>
									<Button
										variant='outlined'
										startIcon={<RefreshIcon />}
										onClick={() => refetchRoles()}
										sx={{ borderRadius: 2 }}
									>
										Обновить
									</Button>
									<Button
										variant='contained'
										startIcon={<AddIcon />}
										onClick={handleCreateRole}
										sx={{ borderRadius: 2 }}
									>
										Добавить роль
									</Button>
								</Box>
							</Box>

							<Divider sx={{ my: 2 }} />

							{roles && Array.isArray(roles) && roles.length > 0 ? (
								<Grid container spacing={2}>
									{roles.map((role: Role) => (
										<Grid size={{ xs: 12, md: 6 }} key={role.role_id}>
											<Paper
												elevation={1}
												sx={{
													p: 3,
													borderRadius: 2,
													border: `1px solid ${alpha(
														theme.palette.divider,
														0.1
													)}`,
													transition: 'all 0.2s',
													'&:hover': {
														boxShadow: `0 4px 12px ${alpha(
															theme.palette.primary.main,
															0.1
														)}`,
													},
												}}
											>
												<Box
													sx={{
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
														mb: 2,
													}}
												>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 1,
														}}
													>
														<ManageAccountsOutlined color='primary' />
														<Typography variant='subtitle1' fontWeight={600}>
															{role.role_name}
														</Typography>
													</Box>
													<Box>
														<Tooltip title='Редактировать'>
															<IconButton
																size='small'
																color='primary'
																onClick={() => handleEditRole(role)}
															>
																<EditIcon fontSize='small' />
															</IconButton>
														</Tooltip>
														<Tooltip title='Удалить'>
															<IconButton
																size='small'
																color='error'
																onClick={() => handleDeleteRole(role)}
																disabled={role.role_name === 'admin'}
															>
																<DeleteIcon fontSize='small' />
															</IconButton>
														</Tooltip>
													</Box>
												</Box>

												<Typography
													variant='body2'
													color='text.secondary'
													sx={{ mb: 2 }}
												>
													{role.description || 'Описание не задано'}
												</Typography>

												<Typography variant='subtitle2' sx={{ mb: 1 }}>
													Права доступа:
												</Typography>
												<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
													{role.permissions && role.permissions.length > 0 ? (
														role.permissions.map((permission, index) => {
															const permInfo = availablePermissions.find(
																p => p.id === permission
															);
															return (
																<Chip
																	key={`${role.role_id}-${permission}-${index}`}
																	label={permInfo ? permInfo.name : permission}
																	size='small'
																	color='primary'
																	variant='outlined'
																	sx={{ mb: 0.5 }}
																/>
															);
														})
													) : (
														<Typography variant='body2' color='text.secondary'>
															Нет назначенных прав
														</Typography>
													)}
												</Box>

												<Typography
													variant='caption'
													color='text.secondary'
													sx={{ display: 'block', mt: 2 }}
												>
													ID: {role.role_id}
													{role.created_at && ` • Создана: ${new Date(role.created_at).toLocaleDateString()}`}
												</Typography>
											</Paper>
										</Grid>
									))}
								</Grid>
							) : (
								<Box sx={{ textAlign: 'center', py: 4 }}>
									<ManageAccountsOutlined
										sx={{
											fontSize: 60,
											color: alpha(theme.palette.text.secondary, 0.2),
											mb: 2,
										}}
									/>
									<Typography color='text.secondary'>
										Список ролей пуст
									</Typography>
								</Box>
							)}
						</Box>
					)}

					{/* Таб управления доступом к директориям - ВОЗВРАЩАЕМ ОРИГИНАЛЬНЫЙ КОМПОНЕНТ */}
					{activeTab === 2 && <FileAccessManager />}
				</Box>
			</Paper>

			{/* Остальные диалоги остаются без изменений... */}
			{/* Диалог создания/редактирования пользователя */}
			<Dialog
				open={userDialogOpen}
				onClose={() => setUserDialogOpen(false)}
				maxWidth='sm'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<PersonOutline color='primary' />
							<Typography variant='h6' fontWeight={600}>
								{isEditingUser
									? 'Редактирование пользователя'
									: 'Добавление пользователя'}
							</Typography>
						</Box>
						<IconButton onClick={() => setUserDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Grid container spacing={2}>
						<Grid size={12}>
							<TextField
								fullWidth
								label='Логин'
								value={userFormData.login}
								onChange={e =>
									setUserFormData({ ...userFormData, login: e.target.value })
								}
								variant='outlined'
								required
							/>
						</Grid>
						<Grid size={12}>
							<TextField
								fullWidth
								label={
									isEditingUser
										? 'Новый пароль (оставьте пустым, чтобы не менять)'
										: 'Пароль'
								}
								type='password'
								value={userFormData.password}
								onChange={e =>
									setUserFormData({ ...userFormData, password: e.target.value })
								}
								variant='outlined'
								required={!isEditingUser}
							/>
						</Grid>
						<Grid size={12}>
							<FormControl fullWidth variant='outlined'>
								<InputLabel>Роль</InputLabel>
								<Select
									value={userFormData.roleId || ''}
									onChange={e =>
										setUserFormData({
											...userFormData,
											roleId: Number(e.target.value),
										})
									}
									label='Роль'
									required
								>
									<MenuItem value=''>
										<em>Выберите роль</em>
									</MenuItem>
									{roles && Array.isArray(roles) &&
										roles.map((role: Role) => (
											<MenuItem key={role.role_id} value={role.role_id}>
												{role.role_name}
											</MenuItem>
										))}
								</Select>
							</FormControl>
						</Grid>
					</Grid>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setUserDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={submitUserForm}
						variant='contained'
						disabled={
							!userFormData.login ||
							(!isEditingUser && !userFormData.password) ||
							!userFormData.roleId ||
							createUserMutation.isPending ||
							updateUserMutation.isPending
						}
						startIcon={
							createUserMutation.isPending || updateUserMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : null
						}
						sx={{ borderRadius: 2 }}
					>
						{isEditingUser ? 'Сохранить' : 'Создать'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог подтверждения удаления пользователя */}
			<Dialog
				open={deleteUserDialogOpen}
				onClose={() => setDeleteUserDialogOpen(false)}
				maxWidth='xs'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<DeleteIcon color='error' />
							<Typography variant='h6' fontWeight={600}>
								Удаление пользователя
							</Typography>
						</Box>
						<IconButton onClick={() => setDeleteUserDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Typography variant='body1'>
						Вы действительно хотите удалить пользователя{' '}
						<strong>{userToDelete?.login}</strong>?
					</Typography>
					<Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
						Это действие невозможно отменить.
					</Typography>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setDeleteUserDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={confirmDeleteUser}
						variant='contained'
						color='error'
						disabled={deleteUserMutation.isPending}
						startIcon={
							deleteUserMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : null
						}
						sx={{ borderRadius: 2 }}
					>
						Удалить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог создания/редактирования роли */}
			<Dialog
				open={roleDialogOpen}
				onClose={() => setRoleDialogOpen(false)}
				maxWidth='md'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<ManageAccountsOutlined color='primary' />
							<Typography variant='h6' fontWeight={600}>
								{isEditingRole ? 'Редактирование роли' : 'Добавление роли'}
							</Typography>
						</Box>
						<IconButton onClick={() => setRoleDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Grid container spacing={3}>
						<Grid size={12}>
							<TextField
								fullWidth
								label='Название роли'
								value={roleFormData.name}
								onChange={e =>
									setRoleFormData({ ...roleFormData, name: e.target.value })
								}
								variant='outlined'
								required
								disabled={isEditingRole && roleFormData.name === 'admin'}
							/>
						</Grid>
						<Grid size={12}>
							<TextField
								fullWidth
								label='Описание'
								value={roleFormData.description}
								onChange={e =>
									setRoleFormData({
										...roleFormData,
										description: e.target.value,
									})
								}
								variant='outlined'
								multiline
								rows={2}
							/>
						</Grid>
						<Grid size={12}>
							<Typography variant='subtitle2' sx={{ mb: 2 }}>
								Права доступа:
							</Typography>
							<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
								{availablePermissions.map(permission => (
									<Chip
										key={permission.id}
										label={permission.name}
										clickable
										color={
											roleFormData.permissions &&
											roleFormData.permissions.includes(permission.id)
												? 'primary'
												: 'default'
										}
										variant={
											roleFormData.permissions &&
											roleFormData.permissions.includes(permission.id)
												? 'filled'
												: 'outlined'
										}
										onClick={() => handlePermissionToggle(permission.id)}
										sx={{ mb: 1 }}
									/>
								))}
							</Box>
						</Grid>
					</Grid>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setRoleDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={submitRoleForm}
						variant='contained'
						disabled={
							!roleFormData.name ||
							createRoleMutation.isPending ||
							updateRoleMutation.isPending
						}
						startIcon={
							createRoleMutation.isPending || updateRoleMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : null
						}
						sx={{ borderRadius: 2 }}
					>
						{isEditingRole ? 'Сохранить' : 'Создать'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог подтверждения удаления роли */}
			<Dialog
				open={deleteRoleDialogOpen}
				onClose={() => setDeleteRoleDialogOpen(false)}
				maxWidth='xs'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<DeleteIcon color='error' />
							<Typography variant='h6' fontWeight={600}>
								Удаление роли
							</Typography>
						</Box>
						<IconButton onClick={() => setDeleteRoleDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Typography variant='body1'>
						Вы действительно хотите удалить роль{' '}
						<strong>{roleToDelete?.role_name}</strong>?
					</Typography>
					<Typography variant='body2' color='error' sx={{ mt: 1 }}>
						Внимание! Все пользователи с этой ролью потеряют свои права доступа.
					</Typography>
					<Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
						Это действие невозможно отменить.
					</Typography>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setDeleteRoleDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={confirmDeleteRole}
						variant='contained'
						color='error'
						disabled={
							deleteRoleMutation.isPending ||
							roleToDelete?.role_name === 'admin'
						}
						startIcon={
							deleteRoleMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : null
						}
						sx={{ borderRadius: 2 }}
					>
						Удалить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Снэкбар для уведомлений */}
			<Snackbar
				open={snackbar.open}
				autoHideDuration={4000}
				onClose={() => setSnackbar({ ...snackbar, open: false })}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
			>
				<Alert
					onClose={() => setSnackbar({ ...snackbar, open: false })}
					severity={snackbar.severity}
					variant='filled'
					sx={{ width: '100%', borderRadius: 2 }}
				>
					{snackbar.message}
				</Alert>
			</Snackbar>
		</Box>
	);
};

export default UsersPermissionsPage;