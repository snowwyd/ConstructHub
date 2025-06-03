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
	FormControlLabel,
	Grid,
	IconButton,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	Snackbar,
	Switch,
	Tab,
	Tabs,
	TextField,
	Tooltip,
	Typography,
	useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { axiosFetching, axiosFetchingFiles } from '../api/AxiosFetch';
import config from '../constants/Configurations.json';
import ErrorState from './ErrorState';
import FileAccessManager from './FileAccessManager';
import LoadingState from './LoadingState';

// Интерфейсы для типизации данных
interface User {
	id: number;
	login: string;
	role_id: number;
	role_name: string;
	created_at: string;
	updated_at: string;
}

interface Role {
	id: number;
	name: string;
	description: string;
	permissions: string[];
	created_at: string;
	updated_at: string;
}

interface Directory {
	id: number;
	name_folder: string;
	status: string;
	parent_path_id?: number | null;
}

interface UserAccess {
	id: number;
	user_id: number;
	user_login?: string;
	directory_id: number;
	directory_name?: string;
	can_read: boolean;
	can_write: boolean;
	can_delete: boolean;
	created_at: string;
	updated_at: string;
}

// Списки доступных прав для ролей
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

// Эндпоинты
const getUsersAccess = config.getUserAccess || '/admin/users/1/tree';
const updateUserAccess =
	config.updateUserAccess || '/admin/users/:user_id/tree';
const createUserAccess =
	config.createUserAccess || '/admin/users/1/tree/create';
const deleteUserAccess = config.deleteUserAccess || '/admin/users/1/tree';

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

	// Состояние для назначения доступа к директориям
	const [accessDialogOpen, setAccessDialogOpen] = useState(false);
	const [accessFormData, setAccessFormData] = useState<{
		id: number;
		userId: number | null;
		directoryId: number | null;
		canRead: boolean;
		canWrite: boolean;
		canDelete: boolean;
	}>({
		id: 0,
		userId: null,
		directoryId: null,
		canRead: true,
		canWrite: false,
		canDelete: false,
	});
	const [isEditingAccess, setIsEditingAccess] = useState(false);
	const [deleteAccessDialogOpen, setDeleteAccessDialogOpen] = useState(false);
	const [accessToDelete, setAccessToDelete] = useState<UserAccess | null>(null);
	const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

	// Запросы к API для получения пользователей
	const {
		data: users,
		isLoading: isUsersLoading,
		isError: isUsersError,
		refetch: refetchUsers,
	} = useQuery({
		queryKey: ['admin', 'users'],
		queryFn: async () => {
			const response = await axiosFetching.get('/admin/users');
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
			const response = await axiosFetching.get('/admin/roles');
			return response.data;
		},
	});

	// Запросы к API для получения директорий
	const {
		data: directories,
		isLoading: isDirectoriesLoading,
		refetch: refetchDirectories,
	} = useQuery({
		queryKey: ['admin', 'directories'],
		queryFn: async () => {
			const response = await axiosFetchingFiles.post('/directories', {
				is_archive: false,
			});
			return response.data;
		},
	});

	// Запросы к API для получения доступов пользователей
	const {
		data: userAccess,
		isLoading: isUserAccessLoading,
		isError: isUserAccessError,
		refetch: refetchUserAccess,
	} = useQuery({
		queryKey: ['admin', 'userAccess', selectedUserId],
		queryFn: async () => {
			// Если выбран конкретный пользователь, получаем только его доступы
			const url = selectedUserId
				? `${getUsersAccess}/${selectedUserId}`
				: getUsersAccess;
			const response = await axiosFetchingFiles.get(url);
			return response.data;
		},
		enabled: activeTab === 2, // Запрашиваем только когда активна вкладка с доступами
	});

	// Мутации для пользователей
	const createUserMutation = useMutation({
		mutationFn: async (userData: {
			login: string;
			password: string;
			role_id: number;
		}) => {
			const response = await axiosFetching.post(
				'/admin/users/register',
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
			const response = await axiosFetching.put(
				`/admin/users/${userId}`,
				userData
			);
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
			const response = await axiosFetching.delete('/admin/users', {
				data: { id: userId },
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
			name: string;
			description: string;
			permissions: string[];
		}) => {
			const response = await axiosFetching.post('/admin/roles', roleData);
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
			roleData: { name?: string; description?: string; permissions?: string[] };
		}) => {
			const response = await axiosFetching.put(
				`/admin/roles/${roleId}`,
				roleData
			);
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
			const response = await axiosFetching.delete('/admin/roles', {
				data: { id: roleId },
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

	// Мутации для доступа пользователей
	const createUserAccessMutation = useMutation({
		mutationFn: async (accessData: {
			user_id: number;
			directory_id: number;
			can_read: boolean;
			can_write: boolean;
			can_delete: boolean;
		}) => {
			const response = await axiosFetching.post(createUserAccess, accessData);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Доступ успешно назначен',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'userAccess'] });
			setAccessDialogOpen(false);
			resetAccessForm();
		},
		onError: (error: any) => {
			console.error('Error creating user access:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при назначении доступа: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const updateUserAccessMutation = useMutation({
		mutationFn: async ({
			accessId,
			accessData,
		}: {
			accessId: number;
			accessData: {
				user_id: number;
				directory_id: number;
				can_read: boolean;
				can_write: boolean;
				can_delete: boolean;
			};
		}) => {
			const url = updateUserAccess.replace(
				':user_id',
				accessData.user_id.toString()
			);
			const response = await axiosFetching.put(
				`${url}/${accessId}`,
				accessData
			);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Доступ успешно обновлен',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'userAccess'] });
			setAccessDialogOpen(false);
			resetAccessForm();
		},
		onError: (error: any) => {
			console.error('Error updating user access:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при обновлении доступа: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const deleteUserAccessMutation = useMutation({
		mutationFn: async (accessId: number) => {
			const response = await axiosFetching.delete(deleteUserAccess, {
				data: { id: accessId },
			});
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Доступ успешно удален',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'userAccess'] });
			setDeleteAccessDialogOpen(false);
			setAccessToDelete(null);
		},
		onError: (error: any) => {
			console.error('Error deleting user access:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при удалении доступа: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	// Вспомогательные функции
	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setActiveTab(newValue);
		if (newValue === 2) {
			// Загружаем данные при переключении на вкладку управления доступом
			refetchUserAccess();
		}
	};

	const resetUserForm = () => {
		setUserFormData({ id: 0, login: '', password: '', roleId: 0 });
		setIsEditingUser(false);
	};

	const resetRoleForm = () => {
		setRoleFormData({ id: 0, name: '', description: '', permissions: [] });
		setIsEditingRole(false);
	};

	const resetAccessForm = () => {
		setAccessFormData({
			id: 0,
			userId: null,
			directoryId: null,
			canRead: true,
			canWrite: false,
			canDelete: false,
		});
		setIsEditingAccess(false);
	};

	const handleCreateUser = () => {
		setIsEditingUser(false);
		resetUserForm();
		setUserDialogOpen(true);
	};

	const handleEditUser = (user: User) => {
		setIsEditingUser(true);
		setUserFormData({
			id: user.id,
			login: user.login,
			password: '', // Не заполняем пароль при редактировании
			roleId: user.role_id,
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
			id: role.id,
			name: role.name,
			description: role.description || '',
			permissions: role.permissions || [],
		});
		setRoleDialogOpen(true);
	};

	const handleDeleteRole = (role: Role) => {
		setRoleToDelete(role);
		setDeleteRoleDialogOpen(true);
	};

	const handleCreateAccess = () => {
		setIsEditingAccess(false);
		resetAccessForm();
		setAccessDialogOpen(true);
	};

	const handleEditAccess = (access: UserAccess) => {
		setIsEditingAccess(true);
		setAccessFormData({
			id: access.id,
			userId: access.user_id,
			directoryId: access.directory_id,
			canRead: access.can_read,
			canWrite: access.can_write,
			canDelete: access.can_delete,
		});
		setAccessDialogOpen(true);
	};

	const handleDeleteAccess = (access: UserAccess) => {
		setAccessToDelete(access);
		setDeleteAccessDialogOpen(true);
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
					name: roleFormData.name,
					description: roleFormData.description,
					permissions: roleFormData.permissions,
				},
			});
		} else {
			createRoleMutation.mutate({
				name: roleFormData.name,
				description: roleFormData.description,
				permissions: roleFormData.permissions,
			});
		}
	};

	// Функция для извлечения всех логинов
	const extractLogins = (usersData: any[]): string[] => {
		if (!Array.isArray(usersData)) return [];

		// Проходим по каждой роли и собираем логины из users
		return usersData.flatMap((role) =>
			Array.isArray(role.users)
			? role.users.map((user: any) => user.login)
			: []
		);
	};

		// Использование в компоненте
	const logins = users ? extractLogins(users) : [];

	const submitAccessForm = () => {
		if (!accessFormData.userId || !accessFormData.directoryId) {
			setSnackbar({
				open: true,
				message: 'Необходимо выбрать пользователя и директорию',
				severity: 'error',
			});
			return;
		}

		if (isEditingAccess) {
			updateUserAccessMutation.mutate({
				accessId: accessFormData.id,
				accessData: {
					user_id: accessFormData.userId,
					directory_id: accessFormData.directoryId,
					can_read: accessFormData.canRead,
					can_write: accessFormData.canWrite,
					can_delete: accessFormData.canDelete,
				},
			});
		} else {
			createUserAccessMutation.mutate({
				user_id: accessFormData.userId,
				directory_id: accessFormData.directoryId,
				can_read: accessFormData.canRead,
				can_write: accessFormData.canWrite,
				can_delete: accessFormData.canDelete,
			});
		}
	};

	const confirmDeleteUser = () => {
		if (userToDelete) {
			deleteUserMutation.mutate(userToDelete.id);
		}
	};

	const confirmDeleteRole = () => {
		if (roleToDelete) {
			deleteRoleMutation.mutate(roleToDelete.id);
		}
	};

	const confirmDeleteAccess = () => {
		if (accessToDelete) {
			deleteUserAccessMutation.mutate(accessToDelete.id);
		}
	};

	const handlePermissionToggle = (permission: string) => {
		// Безопасно проверяем наличие разрешения в массиве permissions
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

	// Функция для получения имени пользователя
	const getUserName = (userId: number) => {
		if (!users) return 'Неизвестный пользователь';
		const user = users.find((u: User) => u.id === userId);
		return user ? user.login : 'Неизвестный пользователь';
	};

	// Функция для получения имени директории
	const getDirectoryName = (directoryId: number) => {
		if (!directories || !directories.data) return 'Неизвестная директория';
		const directory = directories.data.find(
			(d: Directory) => d.id === directoryId
		);
		return directory ? directory.name_folder : 'Неизвестная директория';
	};

	// Проверка на загрузку и ошибки
	if (
		(activeTab === 0 && isUsersLoading) ||
		(activeTab === 1 && isRolesLoading) ||
		(activeTab === 2 && isUserAccessLoading)
	) {
		const loadingMessage =
			activeTab === 0
				? 'Загрузка пользователей...'
				: activeTab === 1
				? 'Загрузка ролей...'
				: 'Загрузка прав доступа...';
		return <LoadingState message={loadingMessage} />;
	}

	if (
		(activeTab === 0 && isUsersError) ||
		(activeTab === 1 && isRolesError) ||
		(activeTab === 2 && isUserAccessError)
	) {
		const retryFunction =
			activeTab === 0
				? refetchUsers
				: activeTab === 1
				? refetchRoles
				: refetchUserAccess;
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
								{users.flatMap((role: any) =>
								role.users.map((user: User, index: number) => (
									<Grid item xs={12} md={6} lg={4} key={`${role.role_name}-${user.id}-${index}`}>
									<Paper
										elevation={1}
										sx={{
										p: 2,
										borderRadius: 2,
										border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
										transition: 'all 0.2s',
										'&:hover': {
											boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
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
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
											label={role.role_name || 'Без роли'}
											size='small'
											color={role.role_name === 'admin' ? 'primary' : 'default'}
											variant='outlined'
										/>
										</Box>
										<Typography
										variant='caption'
										color='text.secondary'
										sx={{ display: 'block', mt: 1 }}
										>
										ID: {user.id} • Создан:{' '}
										{new Date(user.created_at).toLocaleDateString()}
										</Typography>
									</Paper>
									</Grid>
								))
								)}
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
										<Grid item xs={12} md={6} key={role.id}>
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
															{role.name}
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
																disabled={role.name === 'admin'} // Защита от удаления роли admin
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
													{role.description}
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
																	key={`${role.id}-${permission}-${index}`}
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
													ID: {role.id} • Создана:{' '}
													{new Date(role.created_at).toLocaleDateString()}
												</Typography>
											</Paper>
										</Grid>
									))}
								</Grid>
							) : (
								<Box sx={{ textAlign: 'center', py: 4 }}>
									<SecurityOutlined
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

					{/* Таб управления доступом к директориям */}
					{activeTab === 2 && <FileAccessManager />}
				</Box>
			</Paper>

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
						<Grid item xs={12}>
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
						<Grid item xs={12}>
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
						<Grid item xs={12}>
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
									{roles &&
										roles.map((role: Role) => (
											<MenuItem key={role.id} value={role.id}>
												{role.name}
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
							<SecurityOutlined color='primary' />
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
						<Grid item xs={12}>
							<TextField
								fullWidth
								label='Название роли'
								value={roleFormData.name}
								onChange={e =>
									setRoleFormData({ ...roleFormData, name: e.target.value })
								}
								variant='outlined'
								required
								disabled={isEditingRole && roleFormData.name === 'admin'} // Не даем изменить имя роли admin
							/>
						</Grid>
						<Grid item xs={12}>
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
						<Grid item xs={12}>
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
						<strong>{roleToDelete?.name}</strong>?
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
							(roleToDelete && roleToDelete.name === 'admin')
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

			{/* Диалог создания/редактирования доступа */}
			<Dialog
				open={accessDialogOpen}
				onClose={() => setAccessDialogOpen(false)}
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
							<FolderOutlined color='primary' />
							<Typography variant='h6' fontWeight={600}>
								{isEditingAccess
									? 'Редактирование доступа'
									: 'Назначение доступа к директории'}
							</Typography>
						</Box>
						<IconButton onClick={() => setAccessDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Grid container spacing={2}>
						<Grid item xs={12}>
							<FormControl fullWidth variant='outlined' required>
								<InputLabel>Пользователь</InputLabel>
								<Select
									value={accessFormData.userId || ''}
									onChange={e =>
										setAccessFormData({
											...accessFormData,
											userId: e.target.value ? Number(e.target.value) : null,
										})
									}
									label='Пользователь'
									disabled={isEditingAccess} // Нельзя менять пользователя при редактировании
								>
									<MenuItem value=''>
										<em>Выберите пользователя</em>
									</MenuItem>
									{users &&
										users.map((user: User) => (
											<MenuItem key={user.id} value={user.id}>
												{user.login}{' '}
												{user.role_name ? `(${user.role_name})` : ''}
											</MenuItem>
										))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12}>
							<FormControl fullWidth variant='outlined' required>
								<InputLabel>Директория</InputLabel>
								<Select
									value={accessFormData.directoryId || ''}
									onChange={e =>
										setAccessFormData({
											...accessFormData,
											directoryId: e.target.value
												? Number(e.target.value)
												: null,
										})
									}
									label='Директория'
									disabled={isEditingAccess} // Нельзя менять директорию при редактировании
								>
									<MenuItem value=''>
										<em>Выберите директорию</em>
									</MenuItem>
									{directories &&
										directories.data &&
										directories.data.map((dir: Directory) => (
											<MenuItem key={dir.id} value={dir.id}>
												{dir.name_folder}
											</MenuItem>
										))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12}>
							<Typography variant='subtitle2' gutterBottom>
								Права доступа:
							</Typography>
							<FormControlLabel
								control={
									<Switch
										checked={accessFormData.canRead}
										onChange={e =>
											setAccessFormData({
												...accessFormData,
												canRead: e.target.checked,
											})
										}
										color='primary'
									/>
								}
								label='Чтение'
							/>
							<FormControlLabel
								control={
									<Switch
										checked={accessFormData.canWrite}
										onChange={e =>
											setAccessFormData({
												...accessFormData,
												canWrite: e.target.checked,
											})
										}
										color='primary'
									/>
								}
								label='Запись'
							/>
							<FormControlLabel
								control={
									<Switch
										checked={accessFormData.canDelete}
										onChange={e =>
											setAccessFormData({
												...accessFormData,
												canDelete: e.target.checked,
											})
										}
										color='primary'
									/>
								}
								label='Удаление'
							/>
						</Grid>
					</Grid>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setAccessDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={submitAccessForm}
						variant='contained'
						disabled={
							!accessFormData.userId ||
							!accessFormData.directoryId ||
							createUserAccessMutation.isPending ||
							updateUserAccessMutation.isPending
						}
						startIcon={
							createUserAccessMutation.isPending ||
							updateUserAccessMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : null
						}
						sx={{ borderRadius: 2 }}
					>
						{isEditingAccess ? 'Сохранить' : 'Назначить'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог подтверждения удаления доступа */}
			<Dialog
				open={deleteAccessDialogOpen}
				onClose={() => setDeleteAccessDialogOpen(false)}
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
								Удаление доступа
							</Typography>
						</Box>
						<IconButton onClick={() => setDeleteAccessDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Typography variant='body1'>
						Вы действительно хотите удалить доступ пользователя{' '}
						<strong>
							{accessToDelete ? getUserName(accessToDelete.user_id) : ''}
						</strong>{' '}
						к директории{' '}
						<strong>
							{accessToDelete
								? getDirectoryName(accessToDelete.directory_id)
								: ''}
						</strong>
						?
					</Typography>
					<Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
						Это действие невозможно отменить.
					</Typography>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setDeleteAccessDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={confirmDeleteAccess}
						variant='contained'
						color='error'
						disabled={deleteUserAccessMutation.isPending}
						startIcon={
							deleteUserAccessMutation.isPending ? (
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
