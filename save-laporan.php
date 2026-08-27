<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('ok' => false, 'error' => 'Gunakan metode POST.'));
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload) || !isset($payload['report']) || !is_array($payload['report'])) {
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

    $catatan = str_field($docIn, 'catatan');
    if ($catatan === null) {
        $catatan = 'Gambar tertanam tidak dienkode ke dalam JSON.';
    }

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
            'jumlah_gambar_tertanam' => int_field($docIn, 'jumlah_gambar_tertanam', 0),
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

$report = normalize_report($payload['report']);
if ($report === null) {
    http_response_code(400);
    echo json_encode(array('ok' => false, 'error' => 'Tanggal dan lokasi pemadaman wajib diisi.'));
    exit;
}

$reports = $data['reports'];
$index = isset($payload['index']) && $payload['index'] !== '' && $payload['index'] !== null
    ? intval($payload['index']) : -1;

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
