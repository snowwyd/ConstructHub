import {
	CheckCircle,
	ExpandLess,
	ExpandMore,
	Folder,
	Group,
	InsertDriveFile,
	Person,
	Refresh,
	Save,
} from '@mui/icons-material';
import {
	Alert,
	alpha,
	Box,
	Button,
	Checkbox,
	CircularProgress,
	Collapse,
	IconButton,
	List,
	ListItem,
	ListItemButton,
	ListItemText,
	Paper,
	Snackbar,
	Tooltip,
	Typography,
	useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { axiosFetching, axiosFetchingFiles } from '../api/AxiosFetch';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';

// Интерфейсы для типизации данных
interface User {
	user_id: number;
	login: string;
}

interface RoleGroup {
	role_name: string;
	users: User[];
}

interface File {
	id: number;
	name_file: string;
	directory_id: number;
	user_has_access: boolean;
}

interface Directory {
	directory_id: number;
	name_folder: string;
	parent_path_id?: number | null;
	user_has_access: boolean;
	files: File[];
}

interface AccessChanges {
	directory_ids: number[];
	file_ids: number[];
}

const FileAccessManager = () => {
	const theme = useTheme();

	// Состояния данных
	const [userGroups, setUserGroups] = useState<RoleGroup[]>([]);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [fileTree, setFileTree] = useState<Directory[]>([]);
	const [expandedDirs, setExpandedDirs] = useState<{ [key: number]: boolean }>(
		{}
	);
	const [originalAccess, setOriginalAccess] = useState<AccessChanges>({
		directory_ids: [],
		file_ids: [],
	});
	const [newAccess, setNewAccess] = useState<AccessChanges>({
		directory_ids: [],
		file_ids: [],
	});

	// Состояния UI
	const [loading, setLoading] = useState({
		users: false,
		fileTree: false,
		saveChanges: false,
	});
	const [errors, setErrors] = useState({
		users: null as string | null,
		fileTree: null as string | null,
		saveChanges: null as string | null,
	});
	const [snackbar, setSnackbar] = useState({
		open: false,
		message: '',
		severity: 'success' as 'success' | 'error',
	});
	const [expandedRoles, setExpandedRoles] = useState<{
		[key: string]: boolean;
	}>({});

	// Загрузка списка пользователей при монтировании компонента
	useEffect(() => {
		fetchUsers();
	}, []);

	// Загрузка дерева файлов при выборе пользователя
	useEffect(() => {
		if (selectedUser) {
			fetchFileTree(selectedUser.user_id);
		}
	}, [selectedUser]);

	// Функция для загрузки списка пользователей
	const fetchUsers = async () => {
		setLoading(prev => ({ ...prev, users: true }));
		setErrors(prev => ({ ...prev, users: null }));

		try {
			// Используем эндпоинт из микросервиса ЯДРО: GET "/admin/users"
			const response = await axiosFetching.get('/admin/users');
			setUserGroups(response.data);

			// По умолчанию разворачиваем все группы ролей
			const expanded: { [key: string]: boolean } = {};
			response.data.forEach((group: RoleGroup) => {
				expanded[group.role_name] = true;
			});
			setExpandedRoles(expanded);
		} catch (error) {
			console.error('Error fetching users:', error);
			setErrors(prev => ({
				...prev,
				users: 'Не удалось загрузить список пользователей',
			}));
			setSnackbar({
				open: true,
				message: 'Ошибка при загрузке списка пользователей',
				severity: 'error',
			});
		} finally {
			setLoading(prev => ({ ...prev, users: false }));
		}
	};

	// Функция для загрузки дерева файлов для конкретного пользователя
	const fetchFileTree = async (userId: number) => {
		setLoading(prev => ({ ...prev, fileTree: true }));
		setErrors(prev => ({ ...prev, fileTree: null }));

		try {
			// Используем правильный эндпоинт из микросервиса файлов
			// GET "/admin/users/:user_id/tree"
			const response = await axiosFetchingFiles.get(
				`/admin/users/${userId}/tree`
			);

			// Обрабатываем полученные данные
			const directories = response.data;
			setFileTree(directories);

			// Инициализация исходных доступов
			const dirIds = directories
				.filter((dir: Directory) => dir.user_has_access)
				.map((dir: Directory) => dir.directory_id);

			const fileIds = directories.flatMap((dir: Directory) =>
				dir.files.filter(file => file.user_has_access).map(file => file.id)
			);

			const initialAccess = {
				directory_ids: dirIds,
				file_ids: fileIds,
			};

			setOriginalAccess(initialAccess);
			setNewAccess(initialAccess);

			// По умолчанию раскрываем первый уровень директорий
			const expanded: { [key: number]: boolean } = {};
			directories
				.filter((dir: Directory) => !dir.parent_path_id) // Только корневые директории
				.forEach((dir: Directory) => {
					expanded[dir.directory_id] = true;
				});
			setExpandedDirs(expanded);
		} catch (error) {
			console.error('Error fetching file tree:', error);
			setErrors(prev => ({
				...prev,
				fileTree: 'Не удалось загрузить дерево файлов',
			}));
			setSnackbar({
				open: true,
				message: 'Ошибка при загрузке дерева файлов',
				severity: 'error',
			});
		} finally {
			setLoading(prev => ({ ...prev, fileTree: false }));
		}
	};

	// Обработчик выбора пользователя
	const handleUserSelect = (user: User) => {
		setSelectedUser(user);
	};

	// Обработчик разворачивания/сворачивания директории
	const handleToggleDir = (dirId: number) => {
		setExpandedDirs(prev => ({
			...prev,
			[dirId]: !prev[dirId],
		}));
	};

	// Обработчик разворачивания/сворачивания группы ролей
	const handleToggleRole = (roleName: string) => {
		setExpandedRoles(prev => ({
			...prev,
			[roleName]: !prev[roleName],
		}));
	};

	// Обработчик изменения чекбокса директории
	const handleDirAccessChange = (dirId: number, checked: boolean) => {
		setNewAccess(prev => {
			const newDirIds = checked
				? [...prev.directory_ids, dirId]
				: prev.directory_ids.filter(id => id !== dirId);

			return {
				...prev,
				directory_ids: newDirIds,
			};
		});
	};

	// Обработчик изменения чекбокса файла
	const handleFileAccessChange = (fileId: number, checked: boolean) => {
		setNewAccess(prev => {
			const newFileIds = checked
				? [...prev.file_ids, fileId]
				: prev.file_ids.filter(id => id !== fileId);

			return {
				...prev,
				file_ids: newFileIds,
			};
		});
	};

	// Сохранение изменений доступа
	const handleSaveChanges = async () => {
		if (!selectedUser) return;

		setLoading(prev => ({ ...prev, saveChanges: true }));
		setErrors(prev => ({ ...prev, saveChanges: null }));

		try {
			// Отправляем запрос на обновление доступов
			// Используем эндпоинт ЯДРА: PUT "/admin/users/:user_id/assign"
			// с правильной структурой данных { directory_ids: [...], file_ids: [...] }
			await axiosFetching.put(
				`/admin/users/${selectedUser.user_id}/assign`,
				newAccess
			);

			setOriginalAccess(newAccess);
			setSnackbar({
				open: true,
				message: 'Доступы успешно обновлены',
				severity: 'success',
			});

			// Перезагрузим дерево файлов для отображения актуальных доступов
			await fetchFileTree(selectedUser.user_id);
		} catch (error) {
			console.error('Error saving access changes:', error);
			setErrors(prev => ({
				...prev,
				saveChanges: 'Не удалось сохранить изменения',
			}));
			setSnackbar({
				open: true,
				message: 'Ошибка при обновлении доступов',
				severity: 'error',
			});
		} finally {
			setLoading(prev => ({ ...prev, saveChanges: false }));
		}
	};

	// Проверка наличия несохраненных изменений
	const hasUnsavedChanges = () => {
		return JSON.stringify(originalAccess) !== JSON.stringify(newAccess);
	};

	// Преобразование плоского списка директорий в древовидную структуру
	const buildDirectoryTree = (directories: Directory[]) => {
		// Создаем Map для быстрого доступа к директориям по ID
		const dirMap = new Map<number, Directory & { children: Directory[] }>();

		// Подготавливаем директории добавляя поле для хранения детей
		const dirsWithChildren = directories.map(dir => ({
			...dir,
			children: [] as Directory[],
		}));

		// Заполняем Map
		dirsWithChildren.forEach(dir => {
			dirMap.set(dir.directory_id, dir);
		});

		// Формируем иерархическую структуру
		const rootDirs: (Directory & { children: Directory[] })[] = [];

		dirsWithChildren.forEach(dir => {
			if (dir.parent_path_id && dirMap.has(dir.parent_path_id)) {
				// Добавляем директорию к родительской
				const parent = dirMap.get(dir.parent_path_id);
				if (parent) {
					parent.children.push(dir);
				}
			} else {
				// Если нет родителя или родитель недоступен, считаем корневой
				rootDirs.push(dir);
			}
		});

		return rootDirs;
	};

	// Рендер дерева директорий и файлов
	const renderFileTree = (directories: Directory[]) => {
		const rootDirs = buildDirectoryTree(directories);

		// Рекурсивная функция для рендеринга директории
		const renderDir = (
			dir: Directory & { children?: Directory[] },
			level = 0
		) => {
			const isExpanded = expandedDirs[dir.directory_id] || false;
			const isDirChecked = newAccess.directory_ids.includes(dir.directory_id);
			const hasUnsavedDirChange =
				originalAccess.directory_ids.includes(dir.directory_id) !==
				newAccess.directory_ids.includes(dir.directory_id);

			return (
				<Box key={`dir-${dir.directory_id}`}>
					<ListItem
						sx={{
							pl: 2 + level * 2,
							py: 1,
							borderLeft:
								level === 0
									? `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
									: 'none',
							'&:hover': {
								bgcolor: alpha(theme.palette.primary.main, 0.05),
							},
							// Подсветка измененных элементов
							bgcolor: hasUnsavedDirChange
								? alpha(theme.palette.info.light, 0.1)
								: 'transparent',
						}}
					>
						<Checkbox
							checked={isDirChecked}
							onChange={e =>
								handleDirAccessChange(dir.directory_id, e.target.checked)
							}
							color='primary'
							size='small'
						/>
						<IconButton
							size='small'
							onClick={() => handleToggleDir(dir.directory_id)}
						>
							{isExpanded ? <ExpandLess /> : <ExpandMore />}
						</IconButton>
						<Folder
							fontSize='small'
							color={isDirChecked ? 'primary' : 'action'}
							sx={{ mx: 1 }}
						/>
						<ListItemText
							primary={dir.name_folder}
							slotProps={{
								primary: {
									style: {
										fontWeight: isDirChecked ? 600 : 400,
										color: isDirChecked ? theme.palette.primary.main : 'inherit',
									}
								}
							}}
						/>
					</ListItem>

					<Collapse in={isExpanded} timeout='auto' unmountOnExit>
						<Box>
							{/* Рендерим файлы директории */}
							{dir.files &&
								dir.files.map(file => {
									const isFileChecked = newAccess.file_ids.includes(file.id);
									const hasUnsavedFileChange =
										originalAccess.file_ids.includes(file.id) !==
										newAccess.file_ids.includes(file.id);

									return (
										<ListItem
											key={`file-${file.id}`}
											sx={{
												pl: 6 + level * 2,
												py: 0.5,
												'&:hover': {
													bgcolor: alpha(theme.palette.primary.main, 0.05),
												},
												// Подсветка измененных элементов
												bgcolor: hasUnsavedFileChange
													? alpha(theme.palette.info.light, 0.1)
													: 'transparent',
											}}
										>
											<Checkbox
												checked={isFileChecked}
												onChange={e =>
													handleFileAccessChange(file.id, e.target.checked)
												}
												color='primary'
												size='small'
											/>
											<InsertDriveFile
												fontSize='small'
												color={isFileChecked ? 'primary' : 'action'}
												sx={{ mx: 1 }}
											/>
											<ListItemText
												primary={file.name_file}
												slotProps={{
													primary: {
														style: {
															fontSize: '0.875rem',
															fontWeight: isFileChecked ? 500 : 400,
														}
													}
												}}
											/>
										</ListItem>
									);
								})}

							{/* Рендерим вложенные директории */}
							{dir.children &&
								dir.children.map(childDir => renderDir(childDir, level + 1))}
						</Box>
					</Collapse>
				</Box>
			);
		};

		return rootDirs.map(dir => renderDir(dir));
	};

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
						Управление доступом к файлам
					</Typography>
					<Typography variant='body1' color='text.secondary'>
						Настройка доступа пользователей к файлам и директориям
					</Typography>
				</Box>

				{/* Контент */}
				<Box sx={{ display: 'flex', p: 0 }}>
					{/* Список пользователей */}
					<Box
						sx={{
							width: 300,
							borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
							overflowY: 'auto',
							maxHeight: 'calc(100vh - 240px)',
						}}
					>
						<Box
							sx={{
								p: 2,
								borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
							}}
						>
							<Typography variant='subtitle1' fontWeight={600}>
								Пользователи
							</Typography>
							<Tooltip title='Обновить список пользователей'>
								<IconButton
									size='small'
									onClick={fetchUsers}
									disabled={loading.users}
								>
									<Refresh fontSize='small' />
								</IconButton>
							</Tooltip>
						</Box>

						{loading.users ? (
							<Box sx={{ p: 4, textAlign: 'center' }}>
								<CircularProgress size={24} />
								<Typography variant='body2' sx={{ mt: 1 }}>
									Загрузка пользователей...
								</Typography>
							</Box>
						) : errors.users ? (
							<Box sx={{ p: 4, textAlign: 'center' }}>
								<Typography color='error' variant='body2'>
									{errors.users}
								</Typography>
								<Button
									onClick={fetchUsers}
									variant='outlined'
									size='small'
									sx={{ mt: 2, borderRadius: 2 }}
								>
									Попробовать снова
								</Button>
							</Box>
						) : (
							<List sx={{ p: 0 }}>
								{userGroups.map(group => (
									<Box key={group.role_name}>
										<ListItem disablePadding>
											<ListItemButton
												onClick={() => handleToggleRole(group.role_name)}
												sx={{
													bgcolor: alpha(theme.palette.primary.main, 0.05),
													borderBottom: `1px solid ${alpha(
														theme.palette.divider,
														0.05
													)}`,
												}}
											>
												<Group
													fontSize='small'
													sx={{ mr: 1, color: theme.palette.primary.main }}
												/>
												<ListItemText
													primary={group.role_name}
													slotProps={{
														primary: {
															style: { fontWeight: 600 }
														}
													}}
												/>
												{expandedRoles[group.role_name] ? (
													<ExpandLess />
												) : (
													<ExpandMore />
												)}
											</ListItemButton>
										</ListItem>
										<Collapse
											in={expandedRoles[group.role_name]}
											timeout='auto'
											unmountOnExit
										>
											{group.users.map(user => (
												<ListItem key={user.user_id} disablePadding>
													<ListItemButton
														selected={selectedUser?.user_id === user.user_id}
														onClick={() => handleUserSelect(user)}
														sx={{
															pl: 4,
															py: 1,
															'&.Mui-selected': {
																bgcolor: alpha(theme.palette.primary.main, 0.12),
																'&:hover': {
																	bgcolor: alpha(
																		theme.palette.primary.main,
																		0.18
																	),
																},
															},
														}}
													>
														<Person fontSize='small' sx={{ mr: 1 }} />
														<ListItemText
															primary={user.login}
															slotProps={{
																primary: {
																	style: { fontSize: '0.875rem' }
																}
															}}
														/>
													</ListItemButton>
												</ListItem>
											))}
										</Collapse>
									</Box>
								))}
							</List>
						)}
					</Box>

					{/* Дерево файлов с чекбоксами */}
					<Box sx={{ flex: 1, p: 0 }}>
						<Box
							sx={{
								p: 2,
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
							}}
						>
							<Typography variant='subtitle1' fontWeight={600}>
								{selectedUser
									? `Доступы пользователя: ${selectedUser.login}`
									: 'Выберите пользователя'}
							</Typography>
							<Box sx={{ display: 'flex', gap: 1 }}>
								{selectedUser && (
									<Button
										variant='outlined'
										startIcon={<Refresh />}
										onClick={() =>
											selectedUser && fetchFileTree(selectedUser.user_id)
										}
										disabled={loading.fileTree}
										sx={{ borderRadius: 2 }}
									>
										Обновить
									</Button>
								)}
								<Button
									variant='contained'
									color='primary'
									startIcon={
										loading.saveChanges ? (
											<CircularProgress size={16} />
										) : (
											<Save />
										)
									}
									disabled={
										!selectedUser || !hasUnsavedChanges() || loading.saveChanges
									}
									onClick={handleSaveChanges}
									sx={{ borderRadius: 2 }}
								>
									Сохранить изменения
								</Button>
							</Box>
						</Box>

						<Box
							sx={{
								p: 2,
								overflowY: 'auto',
								maxHeight: 'calc(100vh - 240px)',
							}}
						>
							{!selectedUser ? (
								<Box sx={{ py: 8, textAlign: 'center' }}>
									<Person
										sx={{
											fontSize: 60,
											color: alpha(theme.palette.text.secondary, 0.3),
											mb: 2,
										}}
									/>
									<Typography variant='h6' color='text.secondary'>
										Выберите пользователя слева для управления доступами
									</Typography>
								</Box>
							) : loading.fileTree ? (
								<LoadingState message='Загрузка структуры файлов...' />
							) : errors.fileTree ? (
								<ErrorState
									message={errors.fileTree}
									onRetry={() =>
										selectedUser && fetchFileTree(selectedUser.user_id)
									}
								/>
							) : fileTree.length > 0 ? (
								<List sx={{ p: 0 }}>{renderFileTree(fileTree)}</List>
							) : (
								<Box sx={{ py: 8, textAlign: 'center' }}>
									<Typography variant='body1' color='text.secondary'>
										У пользователя нет доступных файлов и директорий
									</Typography>
								</Box>
							)}

							{hasUnsavedChanges() && (
								<Box
									sx={{
										position: 'sticky',
										bottom: 0,
										left: 0,
										p: 2,
										mt: 2,
										bgcolor: alpha(theme.palette.info.light, 0.1),
										borderRadius: 2,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										boxShadow: `0 -2px 10px ${alpha(
											theme.palette.primary.main,
											0.1
										)}`,
										border: `1px solid ${alpha(
											theme.palette.primary.main,
											0.2
										)}`,
									}}
								>
									<Box>
										<Typography
											variant='body2'
											fontWeight={500}
											color='primary.main'
										>
											Есть несохраненные изменения доступов
										</Typography>
										<Typography variant='caption' color='text.secondary'>
											Изменено директорий:{' '}
											{newAccess.directory_ids.filter(
												id => !originalAccess.directory_ids.includes(id)
											).length +
												originalAccess.directory_ids.filter(
													id => !newAccess.directory_ids.includes(id)
												).length}
											, файлов:{' '}
											{newAccess.file_ids.filter(
												id => !originalAccess.file_ids.includes(id)
											).length +
												originalAccess.file_ids.filter(
													id => !newAccess.file_ids.includes(id)
												).length}
										</Typography>
									</Box>
									<Button
										variant='contained'
										color='primary'
										size='small'
										startIcon={
											loading.saveChanges ? (
												<CircularProgress size={16} />
											) : (
												<CheckCircle />
											)
										}
										onClick={handleSaveChanges}
										disabled={loading.saveChanges}
										sx={{ borderRadius: 2 }}
									>
										{loading.saveChanges
											? 'Сохранение...'
											: 'Сохранить изменения'}
									</Button>
								</Box>
							)}
						</Box>
					</Box>
				</Box>
			</Paper>

			{/* Snackbar для уведомлений */}
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

export default FileAccessManager;
