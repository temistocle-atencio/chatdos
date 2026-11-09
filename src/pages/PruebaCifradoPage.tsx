import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Play, RefreshCw } from 'lucide-react';
import {
  encryptJSON,
  decryptJSON,
  encryptFile,
  decryptFile,
  getChatKey,
  computeSecurityNumber,
} from '../lib/crypto';

interface TestResult {
  name: string;
  ok: boolean;
  details: string;
}

export const PruebaCifradoPage: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [logText, setLogText] = useState('');

  const runCryptoTests = async () => {
    setRunning(true);
    setResults([]);
    setLogText('');
    const newResults: TestResult[] = [];
    const logs: string[] = [];

    const log = (msg: string) => {
      logs.push(msg);
      setLogText(logs.join('\n'));
    };

    try {
      log('Iniciando batería de pruebas criptográficas Web Crypto...');

      // 1. Simulación de 2 pares de llaves ECDH P-256 (Persona A y Persona B)
      log('1. Generando pares de llaves ECDH P-256 de prueba para Persona A y Persona B...');
      const pairA = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
      const pairB = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );

      const jwkA = await window.crypto.subtle.exportKey('jwk', pairA.publicKey);
      const jwkB = await window.crypto.subtle.exportKey('jwk', pairB.publicKey);

      // 2. Derivación de la llave del chat desde ambos lados
      log('2. Derivando llave AES-GCM 256 de chat con HKDF-SHA256 (chatId: "test-chat-01")...');
      const chatKeyA = await getChatKey('test-chat-01', pairA.privateKey, jwkB);
      const chatKeyB = await getChatKey('test-chat-01', pairB.privateKey, jwkA);

      // 3. Prueba de encryptJSON y decryptJSON
      log('3. Probando encryptJSON y decryptJSON con payload estructurado...');
      const payloadOriginal = {
        v: 1,
        text: '¡Mensaje ultra secreto en ChatDos con acentos y emojis 🚀🔐!',
        sentAt: Date.now(),
      };

      const encryptedPayload = await encryptJSON(chatKeyA, payloadOriginal);
      log(`   Ciphertext generado (base64, primeros 30 chars): ${encryptedPayload.ciphertext.slice(0, 30)}...`);
      log(`   IV generado (base64): ${encryptedPayload.iv}`);

      const decryptedPayload = await decryptJSON<typeof payloadOriginal>(
        chatKeyB,
        encryptedPayload.ciphertext,
        encryptedPayload.iv
      );

      const jsonOk =
        decryptedPayload.v === payloadOriginal.v &&
        decryptedPayload.text === payloadOriginal.text &&
        decryptedPayload.sentAt === payloadOriginal.sentAt;

      newResults.push({
        name: 'Cifrado y Descifrado JSON (AES-GCM 256 + IV 12 bytes)',
        ok: jsonOk,
        details: jsonOk
          ? `OK: Texto recuperado exactamente ("${decryptedPayload.text}")`
          : 'ERROR: El contenido descifrado no coincide',
      });

      // 4. Prueba de encryptFile y decryptFile
      log('4. Probando encryptFile y decryptFile con un archivo de texto...');
      const fileContentOriginal = 'Archivo binario confidencial para ChatDos - Tamaño y contenido verificado.';
      const testBlob = new Blob([fileContentOriginal], { type: 'text/plain' });

      const encryptedFileResult = await encryptFile(testBlob);
      log(`   Archivo cifrado tamaño: ${encryptedFileResult.size} bytes (incluye IV 12 bytes al inicio).`);
      log(`   Llave aleatoria del archivo (base64): ${encryptedFileResult.fileKeyBase64}`);

      const decryptedFileBlob = await decryptFile(
        encryptedFileResult.encryptedBlob,
        encryptedFileResult.fileKeyBase64,
        'text/plain'
      );
      const decryptedFileText = await decryptedFileBlob.text();

      const fileOk = decryptedFileText === fileContentOriginal;
      newResults.push({
        name: 'Cifrado y Descifrado de Archivos (Llave independiente + IV al inicio)',
        ok: fileOk,
        details: fileOk
          ? `OK: Archivo descifrado intacto ("${decryptedFileText.slice(0, 35)}...")`
          : 'ERROR: El archivo descifrado no coincide',
      });

      // 5. Prueba del Número de Seguridad (12 grupos de 5 dígitos)
      log('5. Calculando Número de Seguridad de 12 grupos de 5 dígitos...');
      const safetyNumberFromA = await computeSecurityNumber(jwkA, jwkB);
      const safetyNumberFromB = await computeSecurityNumber(jwkB, jwkA);

      log(`   Número desde perspectiva A: ${safetyNumberFromA}`);
      log(`   Número desde perspectiva B: ${safetyNumberFromB}`);

      const groups = safetyNumberFromA.split(' ');
      const safetyOk =
        safetyNumberFromA === safetyNumberFromB &&
        groups.length === 12 &&
        groups.every((g) => g.length === 5 && /^\d{5}$/.test(g));

      newResults.push({
        name: 'Número de Seguridad Simétrico (12 grupos de 5 dígitos = 60 dígitos)',
        ok: safetyOk,
        details: safetyOk
          ? `OK: Ambos participantes obtienen el mismo código (${safetyNumberFromA})`
          : 'ERROR: Los números de seguridad difieren o no tienen el formato correcto',
      });

      log('¡Todas las pruebas criptográficas completadas!');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log(`EXCEPCIÓN EN PRUEBA: ${errorMsg}`);
      newResults.push({
        name: 'Ejecución criptográfica',
        ok: false,
        details: `ERROR: ${errorMsg}`,
      });
    } finally {
      setResults(newResults);
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4 pb-8">
      <div className="w-10 h-[3px] bg-[#F28C1B] mb-1"></div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <h1 className="font-['Poppins'] font-bold text-xl text-[#003A73] dark:text-white">
          Prueba de Cifrado E2EE
        </h1>
      </div>
      <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter']">
        Página de verificación de Web Crypto (ECDH P-256, HKDF-SHA256, AES-GCM 256 y PBKDF2).
      </p>

      {/* Botón para iniciar pruebas (ÚNICO botón naranja de la pantalla) */}
      <button
        onClick={runCryptoTests}
        disabled={running}
        className="h-12 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:brightness-105 active:scale-95 transition-all disabled:opacity-60"
      >
        {running ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin text-[#1F2933]" strokeWidth={2} />
            <span>Ejecutando pruebas...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4 text-[#1F2933]" strokeWidth={2} />
            <span>Ejecutar Prueba de Cifrado</span>
          </>
        )}
      </button>

      {/* Tarjeta de Resultados */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73] space-y-3">
          <h2 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider mb-2">
            Resultados de la Verificación
          </h2>

          <div className="space-y-2">
            {results.map((res, index) => (
              <div
                key={index}
                className="p-3 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] bg-[#F2F4F7] dark:bg-[#1F2933] flex items-start gap-3"
              >
                {res.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1E7A44] shrink-0 mt-0.5" strokeWidth={2} />
                ) : (
                  <XCircle className="w-5 h-5 text-[#B03030] shrink-0 mt-0.5" strokeWidth={2} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-['Poppins'] font-semibold text-xs text-[#003A73] dark:text-white">
                      {res.name}
                    </span>
                    <span
                      className={`font-['Poppins'] font-bold text-xs ${
                        res.ok ? 'text-[#1E7A44]' : 'text-[#B03030]'
                      }`}
                    >
                      {res.ok ? 'OK' : 'ERROR'}
                    </span>
                  </div>
                  <p className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mt-1 break-all">
                    {res.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consola de registros detallados */}
      {logText && (
        <div className="bg-white dark:bg-[#253240] p-4 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
          <h3 className="font-['Poppins'] font-semibold text-xs text-[#5B6670] dark:text-[#E3E7EC] uppercase tracking-wider mb-2">
            Registro de Operaciones
          </h3>
          <pre className="p-3 bg-[#1F2933] text-[#E3E7EC] font-mono text-[11px] rounded-[5px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {logText}
          </pre>
        </div>
      )}
    </div>
  );
};
