import javax.imageio.ImageIO;
import java.awt.AlphaComposite;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;

public final class GenerateAndroidIcons {
    private static final Map<String, Integer> LEGACY_SIZES = new LinkedHashMap<>();
    private static final Map<String, Integer> FOREGROUND_SIZES = new LinkedHashMap<>();

    static {
        LEGACY_SIZES.put("mdpi", 48);
        LEGACY_SIZES.put("hdpi", 72);
        LEGACY_SIZES.put("xhdpi", 96);
        LEGACY_SIZES.put("xxhdpi", 144);
        LEGACY_SIZES.put("xxxhdpi", 192);

        FOREGROUND_SIZES.put("mdpi", 108);
        FOREGROUND_SIZES.put("hdpi", 162);
        FOREGROUND_SIZES.put("xhdpi", 216);
        FOREGROUND_SIZES.put("xxhdpi", 324);
        FOREGROUND_SIZES.put("xxxhdpi", 432);
    }

    private GenerateAndroidIcons() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("Uso: java GenerateAndroidIcons.java <icone-fonte.png> <res-dir>");
        }

        Path sourcePath = Path.of(args[0]).toAbsolutePath().normalize();
        Path resDir = Path.of(args[1]).toAbsolutePath().normalize();
        if (!Files.isRegularFile(sourcePath)) {
            throw new IOException("Ícone-fonte não encontrado: " + sourcePath);
        }

        BufferedImage source = ImageIO.read(sourcePath.toFile());
        if (source == null) {
            throw new IOException("Não foi possível decodificar o PNG: " + sourcePath);
        }
        if (source.getWidth() < 256 || source.getHeight() < 256) {
            throw new IOException("O ícone-fonte deve ter pelo menos 256x256 px.");
        }

        Files.createDirectories(resDir);
        removeGeneratedLauncherResources(resDir);

        for (Map.Entry<String, Integer> entry : LEGACY_SIZES.entrySet()) {
            String density = entry.getKey();
            int size = entry.getValue();
            Path dir = resDir.resolve("mipmap-" + density);
            Files.createDirectories(dir);

            BufferedImage legacy = scaleToSquare(source, size, false);
            writePng(legacy, dir.resolve("ic_launcher.png"));
            writePng(legacy, dir.resolve("ic_launcher_round.png"));

            int foregroundSize = FOREGROUND_SIZES.get(density);
            BufferedImage foreground = makeAdaptiveForeground(source, foregroundSize);
            writePng(foreground, dir.resolve("ic_launcher_foreground.png"));
        }

        Path anyDpi = resDir.resolve("mipmap-anydpi-v26");
        Files.createDirectories(anyDpi);
        Files.writeString(anyDpi.resolve("ic_launcher.xml"), adaptiveXml(), StandardCharsets.UTF_8);
        Files.writeString(anyDpi.resolve("ic_launcher_round.xml"), adaptiveXml(), StandardCharsets.UTF_8);

        Path values = resDir.resolve("values");
        Files.createDirectories(values);
        Files.writeString(
            values.resolve("ic_launcher_background.xml"),
            "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" +
            "<resources>\n" +
            "    <color name=\"ic_launcher_background\">#FFFFFF</color>\n" +
            "</resources>\n",
            StandardCharsets.UTF_8
        );

        System.out.printf(
            "Ícones Android gerados a partir de %s (%dx%d).%n",
            sourcePath.getFileName(), source.getWidth(), source.getHeight()
        );
    }

    private static void removeGeneratedLauncherResources(Path resDir) throws IOException {
        if (!Files.exists(resDir)) return;
        try (var paths = Files.walk(resDir)) {
            paths.filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().startsWith("ic_launcher"))
                .sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException error) {
                        throw new RuntimeException(error);
                    }
                });
        } catch (RuntimeException error) {
            if (error.getCause() instanceof IOException io) throw io;
            throw error;
        }
    }

    private static BufferedImage scaleToSquare(BufferedImage source, int size, boolean transparent) {
        BufferedImage output = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = output.createGraphics();
        try {
            applyQuality(graphics);
            if (!transparent) {
                graphics.setColor(java.awt.Color.WHITE);
                graphics.fillRect(0, 0, size, size);
            }
            double scale = Math.min((double) size / source.getWidth(), (double) size / source.getHeight());
            int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
            int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
            int x = (size - width) / 2;
            int y = (size - height) / 2;
            graphics.drawImage(source, x, y, width, height, null);
        } finally {
            graphics.dispose();
        }
        return output;
    }

    private static BufferedImage makeAdaptiveForeground(BufferedImage source, int size) {
        BufferedImage transparentSource = makeWhiteTransparent(source);
        BufferedImage output = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = output.createGraphics();
        try {
            applyQuality(graphics);
            graphics.setComposite(AlphaComposite.SrcOver);

            // Adaptive icons reserve a central safe zone. Keeping the artwork at 70%
            // avoids clipping on circular, rounded-square and OEM launcher masks.
            int artBox = Math.max(1, (int) Math.round(size * 0.70));
            double scale = Math.min(
                (double) artBox / transparentSource.getWidth(),
                (double) artBox / transparentSource.getHeight()
            );
            int width = Math.max(1, (int) Math.round(transparentSource.getWidth() * scale));
            int height = Math.max(1, (int) Math.round(transparentSource.getHeight() * scale));
            int x = (size - width) / 2;
            int y = (size - height) / 2;
            graphics.drawImage(transparentSource, x, y, width, height, null);
        } finally {
            graphics.dispose();
        }
        return output;
    }

    private static BufferedImage makeWhiteTransparent(BufferedImage source) {
        BufferedImage output = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < source.getHeight(); y++) {
            for (int x = 0; x < source.getWidth(); x++) {
                int argb = source.getRGB(x, y);
                int alpha = (argb >>> 24) & 0xFF;
                int red = (argb >>> 16) & 0xFF;
                int green = (argb >>> 8) & 0xFF;
                int blue = argb & 0xFF;

                // Remove only near-white pixels. Colored logo pixels remain untouched.
                if (alpha > 0 && red >= 246 && green >= 246 && blue >= 246) {
                    alpha = 0;
                }
                output.setRGB(x, y, (alpha << 24) | (red << 16) | (green << 8) | blue);
            }
        }
        return output;
    }

    private static void applyQuality(Graphics2D graphics) {
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.setRenderingHint(RenderingHints.KEY_ALPHA_INTERPOLATION, RenderingHints.VALUE_ALPHA_INTERPOLATION_QUALITY);
    }

    private static void writePng(BufferedImage image, Path path) throws IOException {
        if (!ImageIO.write(image, "png", path.toFile())) {
            throw new IOException("Falha ao gravar PNG: " + path);
        }
    }

    private static String adaptiveXml() {
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" +
            "<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">\n" +
            "    <background android:drawable=\"@color/ic_launcher_background\" />\n" +
            "    <foreground android:drawable=\"@mipmap/ic_launcher_foreground\" />\n" +
            "</adaptive-icon>\n";
    }
}
