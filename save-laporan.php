<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('ok' => false, 'error' => 'Gunakan metode POST.'));
    exit;
}

function request_payload() {
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    if (stripos($contentType, 'multipart/form-data') !== false) {
        $report = isset($_POST['report']) ? json_decode($_POST['report'], true) : null;
        return array(
            'action' => isset($_POST['action']) ? strval($_POST['action']) : 'save',
            'index' => array_key_exists('index', $_POST) && $_POST['index'] !== '' ? $_POST['index'] : null,
            'report' => is_array($report) ? $report : null,
        );
    }
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

$payload = request_payload();
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(array('ok' => false, 'error' => 'Data laporan tidak valid.'));
    exit;
}

$action = isset($payload['action']) ? strval($payload['action']) : 'save';
if ($action !== 'delete' && (!isset($payload['report']) || !is_array($payload['report']))) {
    http_response_code(400);
    echo json_encode(array('ok' => false, 'error' => 'Data laporan tidak valid.'));
    exit;
}

$file = __DIR__ . DIRECTORY_SEPARATOR . 'laporan-data.js';
if (!is_file($file) || !is_readable($file)) {
    http_response_code(500);
    echo json_encode(array('ok' => false, 'error' => 'File laporan-data.js tidak ditemukan.'));
    exit;
}
if (!is_writable($file)) {
    http_response_code(500);
    echo json_encode(array('ok' => false, 'error' => 'laporan-data.js tidak bisa ditulis. Tutup file jika sedang dibuka secara eksklusif.'));
    exit;
}

function load_laporan_file($path) {
    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    $json = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
    $json = preg_replace('/^window\.KARHUTLA_LAPORAN_DATA\s*=\s*/', '', $json, 1);
    $json = rtrim($json);
    if (substr($json, -1) === ';') {
        $json = substr($json, 0, -1);
    }
    $data = json_decode($json, true);
    if (!is_array($data) || !isset($data['reports']) || !is_array($data['reports'])) {
        return null;
    }
    return $data;
}

function blank_to_null($value) {
    if ($value === null) {
        return null;
    }
    if (is_string($value)) {
        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }
    if (is_int($value) || is_float($value)) {
        return $value;
    }
    return null;
}

function str_field($source, $key) {
    return isset($source[$key]) ? blank_to_null($source[$key]) : null;
}

function int_field($source, $key, $fallback) {
    if (!isset($source[$key]) || $source[$key] === '' || $source[$key] === null) {
        return $fallback;
    }
    if (!is_numeric($source[$key])) {
        return $fallback;
    }
    return intval($source[$key]);
}

function bool_field($source, $key) {
    if (!isset($source[$key])) {
        return false;
    }
    $value = $source[$key];
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return intval($value) === 1;
    }
    $text = strtolower(trim(strval($value)));
    return $text === '1' || $text === 'true' || $text === 'eksternal';
}

function photo_dir() {
    $dir = __DIR__ . DIRECTORY_SEPARATOR . 'laporan-foto';
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return null;
        }
    }
    return $dir;
}

function uploaded_photo_list() {
    $out = array();
    if (!isset($_FILES['photos'])) {
        return $out;
    }
    $bag = $_FILES['photos'];
    if (!is_array($bag['name'])) {
        $bag = array(
            'name' => array($bag['name']),
            'type' => array($bag['type']),
            'tmp_name' => array($bag['tmp_name']),
            'error' => array($bag['error']),
            'size' => array($bag['size']),
        );
    }
    $count = count($bag['name']);
    for ($i = 0; $i < $count; $i++) {
        $out[] = array(
            'name' => $bag['name'][$i],
            'type' => isset($bag['type'][$i]) ? $bag['type'][$i] : '',
            'tmp_name' => $bag['tmp_name'][$i],
            'error' => $bag['error'][$i],
            'size' => $bag['size'][$i],
        );
    }
    return $out;
}

function save_uploaded_photos() {
    $saved = array();
    $uploads = uploaded_photo_list();
    if (!$uploads) {
        return $saved;
    }
    $dir = photo_dir();
    if ($dir === null) {
        throw new Exception('Folder laporan-foto tidak bisa dibuat.');
    }
    foreach ($uploads as $file) {
        if (intval($file['error']) !== UPLOAD_ERR_OK) {
            throw new Exception('Gagal mengunggah foto ke folder project.');
        }
        if (intval($file['size']) > 8 * 1024 * 1024) {
            throw new Exception('Foto melebihi 8 MB.');
        }
        $name = basename(strval($file['name']));
        if (!preg_match('/^[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$/i', $name)) {
            throw new Exception('Nama file foto tidak valid.');
        }
        $dest = $dir . DIRECTORY_SEPARATOR . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new Exception('Gagal menyimpan foto ke folder project.');
        }
        $saved[] = 'laporan-foto/' . $name;
    }
    return $saved;
}

function files_field($source) {
    $out = array();
    if (!isset($source['files']) || !is_array($source['files'])) {
        return $out;
    }
    foreach ($source['files'] as $file) {
        $path = blank_to_null($file);
        if ($path && preg_match('#^laporan-foto/[A-Za-z0-9._-]+$#', $path)) {
            $out[] = $path;
        }
    }
    return $out;
}

function normalize_report($input) {
    $opIn = isset($input['operasi_karhutla']) && is_array($input['operasi_karhutla'])
        ? $input['operasi_karhutla'] : array();
    $timIn = isset($opIn['jumlah_tim']) && is_array($opIn['jumlah_tim'])
        ? $opIn['jumlah_tim'] : array();
    $evalIn = isset($input['evaluasi']) && is_array($input['evaluasi'])
        ? $input['evaluasi'] : array();
    $plusIn = isset($evalIn['kelebihan']) && is_array($evalIn['kelebihan'])
        ? $evalIn['kelebihan'] : array();
    $minusIn = isset($evalIn['kekurangan']) && is_array($evalIn['kekurangan'])
        ? $evalIn['kekurangan'] : array();
    $docIn = isset($input['dokumentasi']) && is_array($input['dokumentasi'])
        ? $input['dokumentasi'] : array();

    $tanggal = str_field($opIn, 'tanggal');
    $lokasi = str_field($opIn, 'lokasi_pemadaman');
    if (!$tanggal || !$lokasi) {
        return null;
    }

    $files = files_field($docIn);
    $jumlah = count($files);
    if (!$jumlah) {
        $jumlah = int_field($docIn, 'jumlah_gambar_tertanam', 0);
    }
    $catatan = str_field($docIn, 'catatan');

    return array(
        'sheet_name' => str_field($input, 'sheet_name') ?: $tanggal,
        'operasi_karhutla' => array(
            'tanggal' => $tanggal,
            'mulai_operasi' => str_field($opIn, 'mulai_operasi'),
            'selesai_operasi' => str_field($opIn, 'selesai_operasi'),
            'lokasi_pemadaman' => $lokasi,
            'titik_koordinat_pemadaman' => str_field($opIn, 'titik_koordinat_pemadaman'),
            'eksternal' => bool_field($opIn, 'eksternal'),
            'jumlah_tim' => array(
                'berau_coal' => str_field($timIn, 'berau_coal'),
                'volunteer' => str_field($timIn, 'volunteer'),
                'unit_support' => str_field($timIn, 'unit_support'),
                'peralatan_yang_digunakan' => str_field($timIn, 'peralatan_yang_digunakan'),
                'konsumsi' => str_field($timIn, 'konsumsi'),
            ),
            'jumlah_titik_api_yang_dipadamkan' => str_field($opIn, 'jumlah_titik_api_yang_dipadamkan'),
        ),
        'evaluasi' => array(
            'kelebihan' => array(
                'jumlah_tim' => str_field($plusIn, 'jumlah_tim'),
                'unit_support' => str_field($plusIn, 'unit_support'),
                'peralatan' => str_field($plusIn, 'peralatan'),
                'konsumsi' => str_field($plusIn, 'konsumsi'),
            ),
            'kekurangan' => array(
                'jumlah_tim' => str_field($minusIn, 'jumlah_tim'),
                'unit_support' => str_field($minusIn, 'unit_support'),
                'peralatan_yang_digunakan' => str_field($minusIn, 'peralatan_yang_digunakan'),
                'konsumsi' => str_field($minusIn, 'konsumsi'),
            ),
        ),
        'rencana_kegiatan_besok' => str_field($input, 'rencana_kegiatan_besok'),
        'dokumentasi' => array(
            'jumlah_gambar_tertanam' => $jumlah,
            'files' => $files,
            'catatan' => $catatan,
        ),
    );
}

function report_sort_key($report) {
    $op = isset($report['operasi_karhutla']) ? $report['operasi_karhutla'] : array();
    $tanggal = isset($op['tanggal']) ? $op['tanggal'] : '';
    $mulai = isset($op['mulai_operasi']) ? $op['mulai_operasi'] : '';
    return $tanggal . ' ' . $mulai;
}

$data = load_laporan_file($file);
if ($data === null) {
    http_response_code(500);
    echo json_encode(array('ok' => false, 'error' => 'Gagal membaca isi laporan-data.js.'));
    exit;
}

$reports = $data['reports'];
$index = isset($payload['index']) && $payload['index'] !== '' && $payload['index'] !== null
    ? intval($payload['index']) : -1;

if ($action !== 'delete') {
    try {
        $uploadedPhotos = save_uploaded_photos();
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(array('ok' => false, 'error' => $e->getMessage()));
        exit;
    }
    if ($uploadedPhotos) {
        if (!isset($payload['report']) || !is_array($payload['report'])) {
            $payload['report'] = array();
        }
        if (!isset($payload['report']['dokumentasi']) || !is_array($payload['report']['dokumentasi'])) {
            $payload['report']['dokumentasi'] = array();
        }
        $existingFiles = isset($payload['report']['dokumentasi']['files']) && is_array($payload['report']['dokumentasi']['files'])
            ? $payload['report']['dokumentasi']['files'] : array();
        $payload['report']['dokumentasi']['files'] = array_values(array_unique(array_merge($existingFiles, $uploadedPhotos)));
    }
}

if ($action === 'delete') {
    if ($index < 0 || !isset($reports[$index])) {
        http_response_code(400);
        echo json_encode(array('ok' => false, 'error' => 'Laporan yang akan dihapus tidak ditemukan.'));
        exit;
    }
    array_splice($reports, $index, 1);
    $savedIndex = -1;
} else {
    $report = normalize_report($payload['report']);
    if ($report === null) {
        http_response_code(400);
        echo json_encode(array('ok' => false, 'error' => 'Tanggal dan lokasi pemadaman wajib diisi.'));
        exit;
    }

    if ($index >= 0) {
        if (!isset($reports[$index])) {
            http_response_code(400);
            echo json_encode(array('ok' => false, 'error' => 'Laporan yang akan diubah tidak ditemukan.'));
            exit;
        }
        $reports[$index] = $report;
        $savedIndex = $index;
    } else {
        $reports[] = $report;
        $savedIndex = count($reports) - 1;
    }

    usort($reports, function ($a, $b) {
        return strcmp(report_sort_key($a), report_sort_key($b));
    });

    $savedIndex = 0;
    foreach ($reports as $i => $row) {
        if ($row === $report) {
            $savedIndex = $i;
            break;
        }
    }
}

$data['reports'] = array_values($reports);
$data['total_reports'] = count($data['reports']);
if (!isset($data['source_file']) || !$data['source_file']) {
    $data['source_file'] = 'Form input laporan KARHUTLA';
}

$flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT;
$js = 'window.KARHUTLA_LAPORAN_DATA = ' . json_encode($data, $flags) . ";\n";

$tmp = $file . '.tmp';
if (file_put_contents($tmp, $js, LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(array('ok' => false, 'error' => 'Gagal menulis file sementara.'));
    exit;
}

$copied = @copy($tmp, $file);
@unlink($tmp);
if (!$copied) {
    http_response_code(500);
    echo json_encode(array('ok' => false, 'error' => 'Gagal menyimpan laporan-data.js. Pastikan file tidak dikunci.'));
    exit;
}

echo json_encode(array(
    'ok' => true,
    'index' => $savedIndex,
    'total_reports' => $data['total_reports'],
    'data' => $data,
));
