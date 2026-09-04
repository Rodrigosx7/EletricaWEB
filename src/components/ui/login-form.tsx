import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { User, Lock, ArrowRight } from "lucide-react";

// Vertex shader (full-screen quad)
const vertexSmokeySource = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

// Fragment shader — ondas glow seguindo o mouse
const fragmentSmokeySource = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord / iResolution;
    vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

    float time = iTime * 0.5;

    vec2 mouse = iMouse / iResolution;
    vec2 rippleCenter = 2.0 * mouse - 1.0;

    vec2 distortion = centeredUV;
    for (float i = 1.0; i < 8.0; i++) {
        distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
        distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
    }

    float wave = abs(sin(distortion.x + distortion.y + time));
    float glow = smoothstep(0.9, 0.2, wave);

    fragColor = vec4(u_color * glow, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

type BlurSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface SmokeyBackgroundProps {
  backdropBlurAmount?: BlurSize;
  color?: string;
  className?: string;
}

const blurClassMap: Record<BlurSize, string> = {
  none: "backdrop-blur-none",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.substring(1, 3), 16) / 255;
  const g = parseInt(hex.substring(3, 5), 16) / 255;
  const b = parseInt(hex.substring(5, 7), 16) / 255;
  return [r, g, b];
}

export function SmokeyBackground({
  backdropBlurAmount = "sm",
  color = "#FFD60A",
  className = "",
}: SmokeyBackgroundProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL não suportado");
      return;
    }

    const compileShader = (
      type: number,
      source: string
    ): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(
          "Erro ao compilar shader:",
          gl.getShaderInfoLog(shader)
        );
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(
      gl.VERTEX_SHADER,
      vertexSmokeySource
    );
    const fragmentShader = compileShader(
      gl.FRAGMENT_SHADER,
      fragmentSmokeySource
    );
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        "Erro ao linkar programa:",
        gl.getProgramInfoLog(program)
      );
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const iMouseLocation = gl.getUniformLocation(program, "iMouse");
    const uColorLocation = gl.getUniformLocation(program, "u_color");

    const startTime = Date.now();
    const [r, g, b] = hexToRgb(color);
    gl.uniform3f(uColorLocation, r, g, b);

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);

      const currentTime = (Date.now() - startTime) / 1000;

      gl.uniform2f(iResolutionLocation, width, height);
      gl.uniform1f(iTimeLocation, currentTime);
      gl.uniform2f(
        iMouseLocation,
        isHovering ? mousePosition.x : width / 2,
        isHovering ? height - mousePosition.y : height / 2
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMousePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    render();

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isHovering, mousePosition, color]);

  const finalBlurClass =
    blurClassMap[backdropBlurAmount] || blurClassMap["sm"];

  return (
    <div
      className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className={`absolute inset-0 ${finalBlurClass}`}></div>
    </div>
  );
}

interface LoginFormProps {
  aoEntrar: (email: string, senha: string) => Promise<void>;
  aoIrParaCadastro: () => void;
  aoIrParaRecuperacao: () => void;
  carregando: boolean;
}

export function LoginForm({
  aoEntrar,
  aoIrParaCadastro,
  aoIrParaRecuperacao,
  carregando,
}: LoginFormProps): ReactElement {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await aoEntrar(email, senha);
  }

  return (
    <div className="w-full max-w-sm p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl">
      <div className="text-center">
        <div className="inline-flex w-14 h-14 rounded-xl bg-[#FFD60A] items-center justify-center mb-3 shadow-lg shadow-yellow-500/30">
          <svg
            className="w-8 h-8 text-[#0D1B2A]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white">Bem-vindo de volta</h2>
        <p className="mt-2 text-sm text-gray-300">
          Entre para acessar o painel
        </p>
      </div>

      <form className="space-y-8" onSubmit={handleSubmit}>
        {/* E-mail */}
        <div className="relative z-0">
          <input
            type="email"
            id="floating_email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-300/60 appearance-none focus:outline-none focus:ring-0 focus:border-[#FFD60A] peer placeholder-transparent"
            placeholder="E-mail"
            required
          />
          <label
            htmlFor="floating_email"
            className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#FFD60A] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            <User className="inline-block mr-2 -mt-1" size={16} />
            E-mail
          </label>
        </div>

        {/* Senha */}
        <div className="relative z-0">
          <input
            type="password"
            id="floating_password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-300/60 appearance-none focus:outline-none focus:ring-0 focus:border-[#FFD60A] peer placeholder-transparent"
            placeholder="Senha"
            required
          />
          <label
            htmlFor="floating_password"
            className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#FFD60A] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            <Lock className="inline-block mr-2 -mt-1" size={16} />
            Senha
          </label>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={aoIrParaRecuperacao}
            className="text-xs text-gray-300 hover:text-[#FFD60A] transition"
          >
            Esqueci minha senha
          </button>
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="group w-full flex items-center justify-center py-3 px-4 bg-[#FFD60A] hover:bg-yellow-400 rounded-lg text-[#0D1B2A] font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D1B2A] focus:ring-[#FFD60A] transition-all duration-300 disabled:opacity-60 shadow-lg shadow-yellow-500/20"
        >
          {carregando ? "Entrando..." : "Entrar"}
          <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Divisor */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-white/20"></div>
          <span className="flex-shrink mx-4 text-gray-400 text-xs">
            OU CONTINUE COM
          </span>
          <div className="flex-grow border-t border-white/20"></div>
        </div>

        {/* Google (placeholder; integração futura) */}
        <button
          type="button"
          onClick={() =>
            alert("Login com Google em breve.")
          }
          className="w-full flex items-center justify-center py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0D1B2A] focus:ring-[#FFD60A] transition-all duration-300"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"
            />
          </svg>
          Entrar com Google
        </button>
      </form>

      <p className="text-center text-xs text-gray-400">
        Ainda não tem conta?{" "}
        <button
          type="button"
          onClick={aoIrParaCadastro}
          className="font-semibold text-[#FFD60A] hover:text-yellow-300 transition"
        >
          Cadastre-se
        </button>
      </p>
    </div>
  );
}

export function LoginCompleto({
  aoEntrar,
  aoIrParaCadastro,
  aoIrParaRecuperacao,
  carregando,
}: LoginFormProps): ReactElement {
  return (
    <main className="relative w-screen h-screen bg-[#0D1B2A] overflow-hidden">
      <SmokeyBackground
        color="#FFD60A"
        backdropBlurAmount="sm"
        className="absolute inset-0"
      />
      <div className="relative z-10 flex items-center justify-center w-full h-full p-4">
        <LoginForm
          aoEntrar={aoEntrar}
          aoIrParaCadastro={aoIrParaCadastro}
          aoIrParaRecuperacao={aoIrParaRecuperacao}
          carregando={carregando}
        />
      </div>
    </main>
  );
}
