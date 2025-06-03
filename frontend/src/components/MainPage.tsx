import {
	DownloadOutlined,
	FileOpenOutlined,
	HighlightOff,
	TextSnippetOutlined,
	UploadFileOutlined,
	Visibility,
} from '@mui/icons-material';
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	IconButton,
	Paper,
	Snackbar,
	Tooltip,
	Typography,
	alpha,
	useTheme,
} from '@mui/material';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import { axiosFetchingFiles } from '../api/AxiosFetch';
import ContextMenu from './ContextMenu';
import FilesTree from './FilesTree';
import TextViewer from './TextViewer';

const MainPage = () => {
	const theme = useTheme();
	const [isDownloading, setIsDownloading] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<
		'success' | 'error' | 'info'
	>('success');
	const [fileInputKey, setFileInputKey] = useState(Date.now()); // Для сброса input file

	const [selectedItem, setSelectedItem] = useState<{
		id: string | null;
		type: 'file' | 'directory' | null;
		name: string | null;
	}>({
		id: null,
		type: null,
		name: null,
	});
	const [modelUrl, setModelUrl] = useState<string | null>(null);
	const [textContent, setTextContent] = useState<string | null>(null);
	const [dropHighlight, setDropHighlight] = useState(false);

	const showNotification = (
		message: string,
		severity: 'success' | 'error' | 'info'
	) => {
		setSnackbarMessage(message);
		setSnackbarSeverity(severity);
		setSnackbarOpen(true);
	};

	const handleItemSelect = async (
		id: string,
		type: 'file' | 'directory',
		name: string
	) => {
		setSelectedItem({ id, type, name });
		setModelUrl(null);
		setTextContent(null);

		if (type === 'file') {
			try {
				const fileId = id.replace('file-', '');

				if (name.endsWith('.glb')) {
					showNotification('Загрузка модели...', 'info');

					const response = await axiosFetchingFiles.get(
						`/files/${fileId}/download-direct`,
						{
							responseType: 'blob',
						}
					);

					// Проверяем тип ответа
					const contentType = response.headers['content-type'];
					if (contentType && contentType.includes('text/html')) {
						showNotification('Сервер вернул HTML вместо GLB файла', 'error');
						return;
					}

					const fileUrl = URL.createObjectURL(response.data);
					setModelUrl(fileUrl);
					showNotification('Модель успешно загружена', 'success');
				} else if (name.endsWith('.txt')) {
					showNotification('Загрузка текстового файла...', 'info');

					const response = await axiosFetchingFiles.get(
						`/files/${fileId}/download-direct`,
						{
							responseType: 'blob',
						}
					);

					// Проверяем тип ответа
					const contentType = response.headers['content-type'];
					if (
						contentType &&
						!contentType.includes('text/plain') &&
						!contentType.includes('application/octet-stream')
					) {
						showNotification('Неверный формат файла', 'error');
						return;
					}

					// Читаем содержимое файла как текст
					const reader = new FileReader();
					reader.onload = e => {
						const content = e.target?.result as string;
						setTextContent(content);
						showNotification('Текстовый файл успешно загружен', 'success');
					};
					reader.onerror = () => {
						showNotification('Ошибка при чтении текстового файла', 'error');
					};
					reader.readAsText(response.data);
				}
			} catch (error) {
				console.error('Ошибка загрузки файла:', error);
				showNotification('Ошибка при загрузке файла', 'error');
			}
		}
	};

	const handleDownload = async () => {
		if (!selectedItem.id || !selectedItem.name) {
			showNotification('Не выбран файл для скачивания', 'error');
			return;
		}

		setIsDownloading(true);
		showNotification('Началась загрузка файла...', 'info');

		try {
			const fileId = selectedItem.id.replace('file-', '');
			const response = await axiosFetchingFiles.get(
				`/files/${fileId}/download-direct`,
				{
					responseType: 'blob',
				}
			);

			const url = window.URL.createObjectURL(new Blob([response.data]));
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', selectedItem.name || 'file');
			document.body.appendChild(link);
			link.click();
			link.remove();

			showNotification('Файл успешно скачан', 'success');
		} catch (error) {
			console.error('Ошибка скачивания файла:', error);
			showNotification('Ошибка при скачивании файла', 'error');
		} finally {
			setIsDownloading(false);
		}
	};

	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		await uploadFiles(files);
		// Сбрасываем input file, чтобы можно было повторно загрузить тот же файл
		setFileInputKey(Date.now());
	};

	const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setDropHighlight(true);
	};

	const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setDropHighlight(false);
	};

	const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setDropHighlight(false);

		const files = Array.from(event.dataTransfer.files);
		if (files.length === 0) return;

		await uploadFiles(files);
	};

	const uploadFiles = async (files: File[] | FileList) => {
		// Проверяем, выбрана ли директория
		if (selectedItem.type !== 'directory') {
			showNotification('Выберите директорию для загрузки файлов', 'error');
			return;
		}

		setIsUploading(true);
		setUploadProgress(0);

		const directoryId = parseInt(selectedItem.id!.replace('dir-', ''), 10);
		const filesArray = Array.from(files);

		try {
			// Информируем пользователя о начале загрузки
			showNotification(`Начата загрузка ${filesArray.length} файлов`, 'info');

			// Загружаем каждый файл по очереди
			for (let i = 0; i < filesArray.length; i++) {
				const file = filesArray[i];
				const formData = new FormData();
				formData.append('file', file);
				formData.append('directory_id', String(directoryId));
				formData.append('name', file.name);

				// Обновляем прогресс
				setUploadProgress(Math.round((i / filesArray.length) * 100));

				await axiosFetchingFiles.post('/files/upload', formData, {
					headers: {
						'Content-Type': 'multipart/form-data',
					},
				});
			}

			setUploadProgress(100);
			showNotification('Все файлы успешно загружены', 'success');

			// Обновляем дерево файлов
			// Предполагается, что компонент FilesTree имеет метод refreshTree
			// Это нужно реализовать отдельно или найти способ вызвать refetch из React Query
		} catch (error) {
			console.error('Ошибка при загрузке файлов:', error);
			showNotification('Ошибка при загрузке файлов', 'error');
		} finally {
			setIsUploading(false);
			setTimeout(() => setUploadProgress(0), 1000); // Сбрасываем прогресс через 1 секунду
		}
	};

	const clearPreview = () => {
		setModelUrl(null);
		setTextContent(null);
	};

	const ModelViewer = ({ url }: { url: string }) => {
		const gltf = useGLTF(url);

		return (
			<Canvas
				camera={{ position: [0, 0, 5], fov: 50 }}
				style={{ width: '100%', height: '100%' }}
			>
				<ambientLight intensity={0.5} />
				<spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
				<primitive object={gltf.scene} scale={0.5} />
				<OrbitControls />
			</Canvas>
		);
	};

	return (
<Box
    className='main-page-container'
    sx={{ p: 2 }}
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
>
    <Box
        sx={{
            display: 'flex',
            gap: 2,
            height: 'calc(100vh - 120px)',
        }}
    >
        {/* Левая панель - Рабочее дерево */}
        <FilesTree
            isArchive={false}
            onItemSelect={handleItemSelect}
        />

        {/* Центральная панель - Предпросмотр */}
        <Paper
            elevation={2}
            sx={{
                flex: 1,
                borderRadius: 3,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: theme.palette.primary.light,
                boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.12)}`,
                position: 'relative',
                border: dropHighlight
                    ? `2px dashed ${theme.palette.primary.main}`
                    : 'none',
            }}
        >
            {/* Панель инструментов файла */}
            <Box
                sx={{
                    bgcolor: alpha(theme.palette.info.light, 0.1),
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    py: 1,
                    px: 2,
                    minHeight: '57px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Typography variant='subtitle1' fontWeight={500}>
                    {selectedItem.name
                        ? `${selectedItem.type === 'directory' ? 'Папка' : 'Файл'}: ${
                              selectedItem.name
                          }`
                        : 'Выберите файл или папку'}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* Кнопка загрузки файлов (видима только если выбрана директория) */}
                    {selectedItem.type === 'directory' && (
                        <Tooltip title='Загрузить файлы'>
                            <Button
                                component='label'
                                variant='outlined'
                                startIcon={<UploadFileOutlined />}
                                disabled={isUploading}
                                sx={{ borderRadius: 2 }}
                            >
                                {isUploading ? (
                                    <>
                                        <CircularProgress size={20} sx={{ mr: 1 }} />
                                        {uploadProgress}%
                                    </>
                                ) : (
                                    'Загрузить'
                                )}
                                <input
                                    key={fileInputKey}
                                    type='file'
                                    hidden
                                    multiple
                                    onChange={handleFileUpload}
                                />
                            </Button>
                        </Tooltip>
                    )}

                    {/* Кнопки управления файлом (видимы только если выбран файл) */}
                    {selectedItem.type === 'file' && (
                        <>
                            {/* Кнопка предпросмотра для GLB файлов */}
                            {selectedItem.name?.endsWith('.glb') && (
                                <Tooltip title='Предпросмотр 3D модели'>
                                    <IconButton
                                        color='primary'
                                        onClick={() =>
                                            handleItemSelect(
                                                selectedItem.id!,
                                                selectedItem.type!,
                                                selectedItem.name!
                                            )
                                        }
                                    >
                                        <Visibility />
                                    </IconButton>
                                </Tooltip>
                            )}

                            {/* Кнопка предпросмотра для TXT файлов */}
                            {selectedItem.name?.endsWith('.txt') && (
                                <Tooltip title='Предпросмотр текстового файла'>
                                    <IconButton
                                        color='primary'
                                        onClick={() =>
                                            handleItemSelect(
                                                selectedItem.id!,
                                                selectedItem.type!,
                                                selectedItem.name!
                                            )
                                        }
                                    >
                                        <TextSnippetOutlined />
                                    </IconButton>
                                </Tooltip>
                            )}

                            {/* Кнопка скачивания */}
                            <Tooltip title='Скачать файл'>
                                <Button
                                    variant='contained'
                                    startIcon={<DownloadOutlined />}
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    sx={{ borderRadius: 2 }}
                                >
                                    {isDownloading ? (
                                        <CircularProgress size={20} color='inherit' />
                                    ) : (
                                        'Скачать'
                                    )}
                                </Button>
                            </Tooltip>
                        </>
                    )}
                </Box>
            </Box>

            {/* Область предпросмотра */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 4,
                    position: 'relative',
                }}
            >
                {modelUrl ? (
                    <>
                        <ModelViewer url={modelUrl} />
                        <IconButton
                            sx={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                bgcolor: alpha(theme.palette.background.paper, 0.8),
                            }}
                            onClick={clearPreview}
                        >
                            <HighlightOff />
                        </IconButton>
                    </>
                ) : textContent ? (
                    <>
                        <TextViewer text={textContent} />
                        <IconButton
                            sx={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                bgcolor: alpha(theme.palette.background.paper, 0.8),
                            }}
                            onClick={clearPreview}
                        >
                            <HighlightOff />
                        </IconButton>
                    </>
                ) : (
                    <Box
                        sx={{
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            border: dropHighlight
                                ? `none`
                                : `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                            borderRadius: 2,
                            p: 4,
                            width: '100%',
                            maxWidth: 500,
                            bgcolor: dropHighlight
                                ? alpha(theme.palette.primary.main, 0.05)
                                : 'transparent',
                        }}
                    >
                        {selectedItem.type === 'directory' ? (
                            <>
                                <UploadFileOutlined
                                    sx={{
                                        fontSize: 60,
                                        color: alpha(theme.palette.primary.main, 0.5),
                                    }}
                                />
                                <Typography color='text.secondary' variant='h6'>
                                    Перетащите файлы сюда или нажмите "Загрузить"
                                </Typography>
                            </>
                        ) : (
                            <>
                                <FileOpenOutlined
                                    sx={{
                                        fontSize: 60,
                                        color: alpha(theme.palette.text.primary, 1),
                                    }}
                                />
                                <Typography color='text.primary'>
                                    Выберите файл для предпросмотра или папку для загрузки
                                </Typography>
                            </>
                        )}
                    </Box>
                )}
            </Box>
        </Paper>

        {/* Правая панель - Архивное дерево */}
        <FilesTree
            isArchive={true}
            onItemSelect={handleItemSelect}
        />
    </Box>

    {/* Контекстное меню */}
    <ContextMenu />

    {/* Уведомления */}
    <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
        <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={snackbarSeverity}
            variant='filled'
            sx={{
                width: '100%',
                borderRadius: 2,
            }}
        >
            {snackbarMessage}
        </Alert>
    </Snackbar>
</Box>
	);
};

export default MainPage;
